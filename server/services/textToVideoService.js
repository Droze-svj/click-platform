// AI B-roll text-to-video — flag-gated provider integration. Generation is OFF
// unless a provider + key (+ model) are configured; otherwise we return an
// honest `status:'unavailable'` and NEVER a fabricated URL (the owner's #1
// rule). Replicate is the supported provider (stable predictions REST); any
// other TTV_PROVIDER value is treated as unconfigured. The request-builder and
// response-parser are PURE so the contract is unit-tested without a live call.
//
// Lifecycle: text-to-video is async (30s–2min). We mirror imageGenerationService
// — send `Prefer: wait` so Replicate holds the connection until the prediction
// settles, then poll the prediction's `urls.get` until terminal (bounded by
// timeoutMs). `getBRollStatus(jobId)` lets a caller poll a job later.

const logger = require('../utils/logger');

const API_ROOT = 'https://api.replicate.com/v1';

function ttvConfig() {
  const provider = String(process.env.TTV_PROVIDER || '').toLowerCase();
  const keyByProvider = {
    replicate: process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || null,
  };
  return {
    provider,
    key: keyByProvider[provider] || null,
    model: process.env.TTV_MODEL_VERSION || null,
  };
}

/** PURE: is a SUPPORTED provider fully configured? (Replicate needs a model.) */
function isTTVConfigured(cfg = ttvConfig()) {
  if (cfg.provider === 'replicate') return !!(cfg.key && cfg.model);
  return false;
}

function clampDuration(d) {
  return Math.max(1, Math.min(30, Number(d) || 3));
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/** PURE: build the provider HTTP request, or null for an unsupported provider. */
function buildProviderRequest(cfg, prompt, opts = {}) {
  const duration = clampDuration(opts.duration);
  if (cfg.provider === 'replicate') {
    return {
      url: `${API_ROOT}/predictions`,
      method: 'POST',
      headers: {
        Authorization: `Token ${cfg.key}`,
        'Content-Type': 'application/json',
        // Hold the connection until the prediction settles (~60s) so we usually
        // avoid polling entirely.
        Prefer: 'wait',
      },
      body: {
        version: cfg.model,
        input: { prompt: String(prompt || '').slice(0, 1000), num_frames: Math.round(duration * 24) },
      },
    };
  }
  return null;
}

/** PURE: normalize a provider response → { status, url, jobId, pollUrl, error? }. */
function parseProviderResponse(cfg, json) {
  if (!json || typeof json !== 'object') return { status: 'error', url: null, jobId: null, pollUrl: null, error: 'empty provider response' };
  if (cfg.provider === 'replicate') {
    const jobId = json.id || null;
    const pollUrl = (json.urls && json.urls.get) || null;
    switch (json.status) {
    case 'succeeded': {
      const out = Array.isArray(json.output) ? json.output[json.output.length - 1] : json.output;
      return out
        ? { status: 'ready', url: String(out), jobId, pollUrl }
        : { status: 'error', url: null, jobId, pollUrl, error: 'provider returned no output url' };
    }
    case 'failed':
    case 'canceled':
      return { status: 'error', url: null, jobId, pollUrl, error: json.error || json.status };
    default:
      // starting / processing → async job the caller can poll by pollUrl/jobId.
      return { status: 'processing', url: null, jobId, pollUrl };
    }
  }
  return { status: 'error', url: null, jobId: null, pollUrl: null, error: 'unsupported provider' };
}

/** Bounded fetch — aborts after timeoutMs so a hung provider can't stall us. */
async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate a B-roll clip from `prompt`. Refines the prompt (real, Gemini-backed)
 * then — only when a provider is configured — calls it and polls until the clip
 * is ready (bounded by opts.timeoutMs, default 90s). Honest `unavailable`
 * otherwise. Returns `processing` (+ jobId) only if it's still rendering when the
 * budget elapses. `opts.fetchImpl` overrides fetch (for tests); never fabricates.
 */
async function generateBRollVideo(prompt, opts = {}) {
  const duration = clampDuration(opts.duration);
  // Lazy require avoids a circular dependency with generativeAssetService.
  const { refineBRollPrompt } = require('./generativeAssetService');
  const refinedPrompt = await refineBRollPrompt(prompt).catch(() => prompt);

  const cfg = ttvConfig();
  const base = { url: null, originalPrompt: prompt, refinedPrompt, duration };

  if (!isTTVConfigured(cfg)) {
    return {
      ...base,
      status: 'unavailable',
      error: 'Text-to-video generation is not configured yet. Your refined prompt is ready for when it is.',
    };
  }

  const request = buildProviderRequest(cfg, refinedPrompt, { duration });
  if (!request) {
    return { ...base, status: 'unavailable', error: `Unsupported text-to-video provider: ${cfg.provider}` };
  }

  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return { ...base, status: 'unavailable', error: 'No fetch implementation available' };

  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 90000;
  const pollMs = Number.isFinite(opts.pollMs) ? opts.pollMs : 2500;
  const reqTimeoutMs = Number.isFinite(opts.reqTimeoutMs) ? opts.reqTimeoutMs : 65000;
  const startedAt = Date.now();

  try {
    const resp = await fetchWithTimeout(fetchImpl, request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
    }, reqTimeoutMs);
    let json = await resp.json().catch(() => null);
    let parsed = parseProviderResponse(cfg, json);

    // Poll until terminal (covers the case where 'Prefer: wait' timed out).
    while (parsed.status === 'processing' && parsed.pollUrl) {
      if (Date.now() - startedAt > timeoutMs) {
        logger.info('[ttv] generation still processing after budget; returning job for later polling', { jobId: parsed.jobId });
        return { ...base, status: 'processing', jobId: parsed.jobId };
      }
      await sleep(pollMs);
      const pollResp = await fetchWithTimeout(fetchImpl, parsed.pollUrl, {
        headers: { Authorization: request.headers.Authorization },
      }, reqTimeoutMs);
      json = await pollResp.json().catch(() => null);
      parsed = parseProviderResponse(cfg, json);
    }

    logger.info('[ttv] B-roll generation settled', { provider: cfg.provider, status: parsed.status, jobId: parsed.jobId });
    return { ...base, ...parsed };
  } catch (err) {
    const aborted = err && (err.name === 'AbortError');
    logger.error('[ttv] B-roll generation failed', { error: err.message, aborted });
    return { ...base, status: 'error', error: aborted ? 'Text-to-video request timed out' : err.message };
  }
}

/**
 * Poll a previously-started job (the jobId returned with status 'processing').
 * Returns { status:'ready'|'processing'|'error', url, jobId } — never a fake url.
 */
async function getBRollStatus(jobId, opts = {}) {
  if (!jobId) return { status: 'error', url: null, jobId: null, error: 'jobId is required' };
  const cfg = ttvConfig();
  if (!isTTVConfigured(cfg)) return { status: 'unavailable', url: null, jobId, error: 'Text-to-video is not configured' };

  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return { status: 'error', url: null, jobId, error: 'No fetch implementation available' };

  const reqTimeoutMs = Number.isFinite(opts.reqTimeoutMs) ? opts.reqTimeoutMs : 30000;
  try {
    const resp = await fetchWithTimeout(fetchImpl, `${API_ROOT}/predictions/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Token ${cfg.key}` },
    }, reqTimeoutMs);
    const json = await resp.json().catch(() => null);
    const parsed = parseProviderResponse(cfg, json);
    return { status: parsed.status, url: parsed.url, jobId: parsed.jobId || jobId, error: parsed.error };
  } catch (err) {
    return { status: 'error', url: null, jobId, error: err.message };
  }
}

module.exports = {
  ttvConfig,
  isTTVConfigured,
  buildProviderRequest,
  parseProviderResponse,
  generateBRollVideo,
  getBRollStatus,
};

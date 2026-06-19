// AI B-roll text-to-video — flag-gated provider integration. Generation is OFF
// unless a provider + key (+ model) are configured; otherwise we return an
// honest `status:'unavailable'` and NEVER a fabricated URL (the owner's #1
// rule). Replicate is the supported provider (stable predictions REST); any
// other TTV_PROVIDER value is treated as unconfigured. The request-builder and
// response-parser are PURE so the contract is unit-tested without a live call.

const logger = require('../utils/logger');

function ttvConfig() {
  const provider = String(process.env.TTV_PROVIDER || '').toLowerCase();
  const keyByProvider = {
    replicate: process.env.REPLICATE_API_TOKEN || null,
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

/** PURE: build the provider HTTP request, or null for an unsupported provider. */
function buildProviderRequest(cfg, prompt, opts = {}) {
  const duration = clampDuration(opts.duration);
  if (cfg.provider === 'replicate') {
    return {
      url: 'https://api.replicate.com/v1/predictions',
      method: 'POST',
      headers: {
        Authorization: `Token ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: {
        version: cfg.model,
        input: { prompt: String(prompt || '').slice(0, 1000), num_frames: Math.round(duration * 24) },
      },
    };
  }
  return null;
}

/** PURE: normalize a provider response → { status, url, jobId, error? }. */
function parseProviderResponse(cfg, json) {
  if (!json || typeof json !== 'object') return { status: 'error', url: null, jobId: null, error: 'empty provider response' };
  if (cfg.provider === 'replicate') {
    const jobId = json.id || null;
    switch (json.status) {
    case 'succeeded': {
      const out = Array.isArray(json.output) ? json.output[json.output.length - 1] : json.output;
      return out
        ? { status: 'ready', url: String(out), jobId }
        : { status: 'error', url: null, jobId, error: 'provider returned no output url' };
    }
    case 'failed':
    case 'canceled':
      return { status: 'error', url: null, jobId, error: json.error || json.status };
    default:
      // starting / processing → async job the caller can poll by jobId.
      return { status: 'processing', url: null, jobId };
    }
  }
  return { status: 'error', url: null, jobId: null, error: 'unsupported provider' };
}

/**
 * Generate a B-roll clip from `prompt`. Refines the prompt (real, Gemini-backed)
 * then — only when a provider is configured — calls it. Honest `unavailable`
 * otherwise. `opts.fetchImpl` overrides fetch (for tests); never fabricates URLs.
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

  const doFetch = opts.fetchImpl || fetch;
  try {
    const resp = await doFetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
    });
    const json = await resp.json().catch(() => null);
    const parsed = parseProviderResponse(cfg, json);
    logger.info('[ttv] B-roll generation request', { provider: cfg.provider, status: parsed.status, jobId: parsed.jobId });
    return { ...base, ...parsed };
  } catch (err) {
    logger.error('[ttv] B-roll generation failed', { error: err.message });
    return { ...base, status: 'error', error: err.message };
  }
}

module.exports = {
  ttvConfig,
  isTTVConfigured,
  buildProviderRequest,
  parseProviderResponse,
  generateBRollVideo,
};

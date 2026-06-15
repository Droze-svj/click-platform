/**
 * imageGenerationService — text→image via Replicate (default: FLUX schnell).
 *
 * The platform had no image generator; this adds one behind a clean,
 * HONESTLY-DEGRADING contract (like liveTrendService): with no REPLICATE_API_KEY
 * it returns { ok:false, unavailable:true } instead of throwing, so the unified
 * Generate endpoint degrades gracefully. The HTTP call is isolated behind an
 * injectable fetch so the request-building + response-parsing are unit-testable
 * without hitting the network or spending credits.
 *
 * Env:
 *   REPLICATE_API_KEY     — enables live generation
 *   REPLICATE_IMAGE_MODEL — override model (default 'black-forest-labs/flux-schnell')
 */

'use strict';

const logger = require('../utils/logger');

const DEFAULT_MODEL = process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-schnell';
const API_ROOT = 'https://api.replicate.com/v1';

function isConfigured() {
  return !!process.env.REPLICATE_API_KEY;
}

/** Pull the first image URL out of Replicate's (varied) output shapes. */
function extractUrl(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const first = output.find((x) => typeof x === 'string');
    return first || null;
  }
  if (typeof output === 'object' && typeof output.url === 'string') return output.url;
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * Generate an image from a prompt.
 *
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string} [opts.aspectRatio='9:16']
 * @param {string} [opts.model]
 * @param {number} [opts.timeoutMs=60000]
 * @param {function} [opts.fetchImpl]  injectable fetch (tests)
 * @param {number} [opts.pollMs=1500]
 * @returns {Promise<{ok:true, url:string, model:string} | {ok:false, unavailable?:boolean, error:string}>}
 */
async function generateImage(prompt, opts = {}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return { ok: false, error: 'A non-empty prompt is required' };
  }
  if (!isConfigured()) {
    return { ok: false, unavailable: true, error: 'Image generation is not configured (set REPLICATE_API_KEY)' };
  }

  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) {
    return { ok: false, unavailable: true, error: 'No fetch implementation available' };
  }

  const model = opts.model || DEFAULT_MODEL;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 60000;
  const pollMs = Number.isFinite(opts.pollMs) ? opts.pollMs : 1500;
  const headers = {
    'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
    'Content-Type': 'application/json',
    // Ask Replicate to hold the connection until the prediction settles (up to
    // ~60s) so we usually avoid polling entirely.
    'Prefer': 'wait',
  };
  const input = {
    prompt: prompt.slice(0, 2000),
    aspect_ratio: typeof opts.aspectRatio === 'string' ? opts.aspectRatio : '9:16',
    output_format: 'png',
  };

  const startedAt = Date.now();
  try {
    let res = await fetchImpl(`${API_ROOT}/models/${model}/predictions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input }),
    });
    let body = await res.json();
    if (!res.ok) {
      logger.warn('[imageGen] create prediction failed', { status: res.status, detail: body?.detail });
      return { ok: false, error: body?.detail || `Image provider error (${res.status})` };
    }

    // Poll until terminal (covers the case where 'Prefer: wait' timed out).
    while (body && (body.status === 'starting' || body.status === 'processing')) {
      if (Date.now() - startedAt > timeoutMs) {
        return { ok: false, error: 'Image generation timed out' };
      }
      await sleep(pollMs);
      const pollUrl = body.urls && body.urls.get;
      if (!pollUrl) break;
      res = await fetchImpl(pollUrl, { headers });
      body = await res.json();
    }

    if (body && body.status === 'succeeded') {
      const url = extractUrl(body.output);
      if (url) return { ok: true, url, model };
      return { ok: false, error: 'Image generation returned no output' };
    }
    return { ok: false, error: body?.error || `Image generation ${body?.status || 'failed'}` };
  } catch (e) {
    logger.warn('[imageGen] threw', { error: e.message });
    return { ok: false, error: e.message || 'Image generation failed' };
  }
}

module.exports = {
  generateImage,
  isConfigured,
  extractUrl,
  DEFAULT_MODEL,
};

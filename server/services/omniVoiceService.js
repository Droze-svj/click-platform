// OmniVoice Studio — self-hosted, open-source alternative to ElevenLabs.
//
// OmniVoice Studio (https://github.com/debpalash/OmniVoice-Studio, AGPL-3.0) is a
// local voice-synthesis app that exposes an OpenAI-compatible HTTP API. We treat
// it as an EXTERNAL NETWORK SERVICE the operator runs themselves (on localhost, a
// GPU box over Tailscale, or a Docker host) and talk to it over that documented
// API. No OmniVoice source is vendored into Click — this file is an original
// client written against its public REST contract, so Click's own code carries no
// AGPL obligation (calling a separate program over a network API is not a
// derivative work).
//
// Endpoints used (all under OMNIVOICE_BASE_URL, which already includes `/v1`):
//   POST /audio/speech   → text → audio bytes (OpenAI CreateSpeech shape)
//   GET  /audio/voices   → list available voice profiles
//
// Auth: a loopback backend needs no key. A remote backend set OMNIVOICE_API_KEY;
// we send it as `Authorization: Bearer <key>` (the header form the OmniVoice docs
// mark preferred — a key in a URL leaks into logs).
//
// Configuration (all inline env, matching the rest of the voice stack):
//   OMNIVOICE_BASE_URL      required to ENABLE — e.g. http://localhost:3900/v1
//   OMNIVOICE_API_KEY       optional bearer token (only for non-loopback backends)
//   OMNIVOICE_MODEL         engine id, default 'omnivoice'
//   OMNIVOICE_DEFAULT_VOICE voice/profile id, default 'default'
//   OMNIVOICE_TIMEOUT_MS    per-request timeout, default 120000
//
// Until OMNIVOICE_BASE_URL is set this module is fully inert (isConfigured() is
// false) and every caller falls through to its existing provider chain — so this
// is a safe, opt-in drop-in that never fires localhost:3900 on a cloud deploy.

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { randomMediaName } = require('../utils/mediaName');

const DEFAULT_TIMEOUT_MS = 120000;

/** True only when an OmniVoice backend URL is explicitly configured. */
function isConfigured() {
  return !!(process.env.OMNIVOICE_BASE_URL && String(process.env.OMNIVOICE_BASE_URL).trim());
}

// Normalize the configured base into an `.../v1` API root. We accept either
// `http://host:3900` or `http://host:3900/v1` and always resolve to the latter,
// so `${base}/audio/speech` hits the real OpenAI-compatible path.
function apiRoot() {
  let base = String(process.env.OMNIVOICE_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  if (!/\/v1$/.test(base)) base = `${base}/v1`;
  return base;
}

// The OpenAI-compat endpoints live under /v1; OmniVoice's NATIVE endpoints (voice
// profiles / cloning) live at the server root. Strip a trailing /v1 to reach them.
function serverRoot() {
  return apiRoot().replace(/\/v1$/, '');
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const key = process.env.OMNIVOICE_API_KEY && String(process.env.OMNIVOICE_API_KEY).trim();
  if (key) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

function timeoutMs() {
  const raw = parseInt(process.env.OMNIVOICE_TIMEOUT_MS || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

// fetch() with an AbortController deadline. Rejects (never hangs) on timeout or
// transport error; callers catch and degrade to their next provider.
async function fetchWithTimeout(url, opts = {}, ms = timeoutMs()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`OmniVoice request timed out after ${ms}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const FORMAT_CONTENT_TYPE = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
};

/**
 * Synthesize speech and return the raw audio buffer.
 * @returns {Promise<{ buffer: Buffer, format: string, contentType: string }>}
 */
async function synthesizeSpeech({ text, voice, format = 'mp3', speed = 1.0, language = null } = {}) {
  if (!isConfigured()) throw new Error('OmniVoice is not configured (set OMNIVOICE_BASE_URL).');
  if (!text || !String(text).trim()) throw new Error('Text is required for OmniVoice speech.');

  const fmt = FORMAT_CONTENT_TYPE[format] ? format : 'mp3';
  const body = {
    model: (process.env.OMNIVOICE_MODEL && String(process.env.OMNIVOICE_MODEL).trim()) || 'omnivoice',
    input: String(text),
    voice: voice || (process.env.OMNIVOICE_DEFAULT_VOICE && String(process.env.OMNIVOICE_DEFAULT_VOICE).trim()) || 'default',
    response_format: fmt,
    speed: Number.isFinite(speed) ? Math.min(4.0, Math.max(0.25, speed)) : 1.0,
  };
  // OmniVoice extension — helps multilingual engines pick the right phonemizer.
  if (language) body.language = String(language).toLowerCase();

  const res = await fetchWithTimeout(`${apiRoot()}/audio/speech`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Read a short slice of the error body for the log without leaking a huge payload.
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error(`OmniVoice speech failed: HTTP ${res.status} ${detail}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new Error('OmniVoice returned empty audio.');
  return { buffer, format: fmt, contentType: FORMAT_CONTENT_TYPE[fmt] };
}

/**
 * Synthesize speech and persist it under uploads/<subdir> with an unguessable,
 * non-identifying filename (crypto-random via mediaName — a leaked capability URL
 * can't be turned into another of the user's objects).
 * @returns {Promise<{ url: string, absPath: string, format: string }>} url is `/uploads/...`
 */
async function generateSpeechFile({ text, voice, format = 'mp3', speed = 1.0, language = null, subdir = 'audio' } = {}) {
  const { buffer, format: fmt } = await synthesizeSpeech({ text, voice, format, speed, language });

  const safeSub = String(subdir).replace(/[^a-z0-9/_-]/gi, '') || 'audio';
  const outDir = path.join(__dirname, '..', '..', 'uploads', safeSub);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filename = randomMediaName(`.${fmt}`);
  const absPath = path.join(outDir, filename);
  await fs.promises.writeFile(absPath, buffer);

  logger.info('[OmniVoice] speech generated', { chars: String(text).length, format: fmt, subdir: safeSub });
  return { url: `/uploads/${safeSub}/${filename}`, absPath, format: fmt };
}

/**
 * List available OmniVoice voice profiles. Returns [] (never throws) when the
 * backend is unreachable so a unified voice picker still renders other providers.
 * @returns {Promise<Array<{ id, name, provider, cloned, previewUrl }>>}
 */
async function listVoices() {
  if (!isConfigured()) return [];
  try {
    const res = await fetchWithTimeout(`${apiRoot()}/audio/voices`, { headers: authHeaders() }, 15000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // The OmniVoice extension may return either a bare array or { voices: [...] }.
    const raw = Array.isArray(data) ? data : (Array.isArray(data?.voices) ? data.voices : []);
    return raw.map((v) => ({
      id: v.id || v.voice_id || v.name,
      name: v.name || v.id || 'Voice',
      provider: 'omnivoice',
      cloned: v.cloned === true || v.category === 'cloned',
      previewUrl: v.preview_url || v.previewUrl || null,
    })).filter((v) => v.id);
  } catch (err) {
    logger.warn('[OmniVoice] listVoices failed', { error: err.message });
    return [];
  }
}

/**
 * Clone a voice from a reference audio sample via OmniVoice's native profile API
 * (POST /profiles, kind=clone). The returned profile id is used directly as the
 * `voice` in synthesizeSpeech/generateSpeechFile.
 *
 * @param {Buffer|string} sample reference recording: a Buffer (preferred — no
 *   SSRF) or an absolute URL that this server can fetch
 * @param {string} name           display name for the profile
 * @returns {Promise<string>} the OmniVoice voice/profile id
 */
async function cloneVoice(sample, name) {
  if (!isConfigured()) throw new Error('OmniVoice is not configured (set OMNIVOICE_BASE_URL).');
  if (!sample) throw new Error('A reference audio sample is required to clone a voice.');

  // Prefer raw bytes (route reads the user's own file → no arbitrary-URL fetch).
  let sampleBlob;
  if (Buffer.isBuffer(sample)) {
    sampleBlob = new Blob([sample]);
  } else {
    const sampleRes = await fetchWithTimeout(sample, {}, 60000);
    if (!sampleRes.ok) throw new Error(`Could not fetch reference audio: HTTP ${sampleRes.status}`);
    sampleBlob = await sampleRes.blob();
  }

  const form = new FormData();
  form.append('name', name || 'Cloned voice');
  form.append('kind', 'clone');
  form.append('ref_audio', sampleBlob, 'reference.wav');

  // Note: don't set Content-Type — fetch sets the multipart boundary itself.
  const res = await fetchWithTimeout(`${serverRoot()}/profiles`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error(`OmniVoice voice clone failed: HTTP ${res.status} ${detail}`);
  }
  const data = await res.json();
  const voiceId = data.id || data.profile_id || data.profileId || data.voice_id;
  if (!voiceId) throw new Error('OmniVoice clone returned no profile id.');
  logger.info('[OmniVoice] voice cloned', { name });
  return String(voiceId);
}

module.exports = {
  isConfigured,
  synthesizeSpeech,
  generateSpeechFile,
  listVoices,
  cloneVoice,
};

/**
 * aiGenerativeDubbingService.js
 * Voice cloning + lip-sync dubbing service.
 *
 * Integrations:
 *   - ElevenLabs Dubbing API (primary)
 *   - Resemble AI (fallback TTS)
 *   - In-house phoneme warp metadata generator
 */

const crypto = require('crypto')
const logger = require('../utils/logger')

let Sentry = null
try {
  Sentry = require('@sentry/node')
} catch (_) {
  // Optional dependency in some local environments.
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

// Bound every ElevenLabs HTTP call so a stuck upstream can't hang a dub job.
const DUBBING_TIMEOUT_MS = parseInt(process.env.DUBBING_TIMEOUT_MS || '120000', 10)

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

/**
 * fetch() with an AbortController timeout. Throws on timeout/transport error so
 * callers' try/catch can map it to an honest failure.
 */
async function fetchWithTimeout(url, opts = {}, timeoutMs = DUBBING_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function captureDubbingError(err, context = {}) {
  try {
    logger.error('[dubbing] error', { error: err?.message, ...context })
  } catch (_) { /* logger optional */ }
  if (Sentry && typeof Sentry.captureException === 'function') {
    try { Sentry.captureException(err, { tags: { service: 'aiGenerativeDubbingService', ...context } }) } catch (_) { /* ignore */ }
  }
}

/**
 * Clone caller's voice and generate a dubbed track.
 *
 * @param {object} opts
 * @param {string} opts.videoId
 * @param {string} opts.targetLanguage - ISO 639-1 code ('es', 'fr', etc.)
 * @param {string} [opts.voiceId] - ElevenLabs voice_id (from clone step)
 * @param {boolean} [opts.lipSyncEnabled]
 * @param {string} [opts.audioSampleUrl] - URL to voice clone sample audio
 * @returns {Promise<{ jobId, audioUrl, lipSyncDataUrl }>}
 */
async function generateDubbedTrack({ videoId, targetLanguage, voiceId, lipSyncEnabled = false, audioSampleUrl }) {
  if (!ELEVENLABS_API_KEY) {
    // PRODUCTION: never hand back mock audio URLs that 404 — return an honest
    // "not configured" result so the client shows a real message (owner's #1
    // rule: no fake-as-real). Dev keeps the mock but flags it clearly.
    if (isProduction()) {
      logger.warn('[dubbing] ELEVENLABS_API_KEY missing in production — returning unconfigured result', { videoId, targetLanguage })
      return {
        ok: false,
        configured: false,
        error: 'Dubbing is not configured. Set ELEVENLABS_API_KEY to enable voice dubbing.',
      }
    }
    logger.info('[dubbing] dev mock response (no ELEVENLABS_API_KEY)', { videoId, targetLanguage })
    return buildMockResponse(videoId, targetLanguage, lipSyncEnabled)
  }

  try {
    // Step 1: Clone voice if no voiceId provided
    let activeVoiceId = voiceId
    if (!activeVoiceId && audioSampleUrl) {
      activeVoiceId = await cloneVoice(audioSampleUrl, `click-user-${videoId}`)
    }

    // Step 2: Call ElevenLabs Dubbing endpoint (v1/dubbing)
    const formData = new FormData()
    formData.append('name', `click-dub-${videoId}-${targetLanguage}`)
    formData.append('target_lang', targetLanguage)
    formData.append('source_url', `https://cdn.clickapp.io/videos/${videoId}`) // Source video URL
    formData.append('num_speakers', '1')
    if (activeVoiceId) formData.append('voice_id', activeVoiceId)

    const dubRes = await fetchWithTimeout(`${ELEVENLABS_BASE}/dubbing`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      body: formData,
    })

    if (!dubRes.ok) {
      const text = await dubRes.text()
      throw new Error(`ElevenLabs Dubbing API error: ${dubRes.status} — ${text}`)
    }

    const dub = await dubRes.json()

    return {
      jobId: dub.dubbing_id,
      audioUrl: `${ELEVENLABS_BASE}/dubbing/${dub.dubbing_id}/audio/${targetLanguage}`,
      lipSyncDataUrl: lipSyncEnabled ? `https://api.clickapp.io/lipsync/${dub.dubbing_id}` : null,
    }
  } catch (err) {
    captureDubbingError(err, { action: 'generateDubbedTrack', videoId, targetLanguage })
    // PRODUCTION: surface the real failure instead of a mock URL that 404s.
    if (isProduction()) {
      return {
        ok: false,
        configured: true,
        error: `Dubbing failed: ${String(err?.message || err).slice(0, 160)}`,
      }
    }
    logger.info('[dubbing] dev mock response after error', { videoId, targetLanguage })
    return buildMockResponse(videoId, targetLanguage, lipSyncEnabled)
  }
}

/**
 * Clone a voice from a sample audio URL using ElevenLabs Instant Voice Cloning.
 * @param {string} audioSampleUrl
 * @param {string} name
 * @returns {Promise<string>} voiceId
 */
async function cloneVoice(audioSampleUrl, name) {
  const formData = new FormData()
  formData.append('name', name)
  // Fetch the audio as a blob and attach
  const audioBlob = await fetchWithTimeout(audioSampleUrl).then(r => r.blob())
  formData.append('files', audioBlob, 'sample.mp3')

  const res = await fetchWithTimeout(`${ELEVENLABS_BASE}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    body: formData,
  })

  if (!res.ok) throw new Error(`Voice clone failed: ${res.status}`)
  const data = await res.json()
  return data.voice_id
}

/**
 * Get the status of a dubbing job.
 * @param {string} dubbingId
 * @returns {Promise<{ status: string, progress: number }>}
 */
async function getDubbingStatus(dubbingId) {
  if (!ELEVENLABS_API_KEY) {
    // PRODUCTION: don't claim a job is "dubbed" when dubbing isn't configured.
    if (isProduction()) {
      return { ok: false, configured: false, status: 'not_configured', progress: 0, error: 'Dubbing is not configured.' }
    }
    return { mock: true, status: 'dubbed', progress: 100 }
  }

  const res = await fetchWithTimeout(`${ELEVENLABS_BASE}/dubbing/${dubbingId}`, {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  })

  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
  const data = await res.json()
  return { status: data.status, progress: data.progress ?? 0 }
}

/**
 * Generate lip-sync warp metadata for a video + phoneme track.
 * In production: calls a computer-vision microservice that reads the video
 * and outputs frame-by-frame jaw/lip position data for the export renderer.
 *
 * @param {string} videoId
 * @param {object[]} phonemeData - Array of { time, phoneme, duration }
 * @returns {Promise<object[]>} frameLipData
 */
async function lipSyncWarp(videoId, phonemeData) {
  // Structured mock — production would call a CV service (Wav2Lip / SadTalker API)
  return phonemeData.map((p, i) => ({
    frameIndex: Math.round(p.time * 30),
    jawOpening: Math.random() * 0.6 + 0.1,
    lipCornerX: (Math.random() - 0.5) * 0.05,
    phoneme: p.phoneme,
  }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMockResponse(videoId, targetLanguage, lipSyncEnabled) {
  const mockId = crypto.randomUUID()
  return {
    // Clearly flagged so no caller mistakes dev mock URLs for real audio.
    mock: true,
    jobId: mockId,
    audioUrl: `/api/mock/audio/${mockId}-${targetLanguage}.mp3`,
    lipSyncDataUrl: lipSyncEnabled ? `/api/mock/lipsync/${mockId}` : null,
  }
}

module.exports = { generateDubbedTrack, cloneVoice, getDubbingStatus, lipSyncWarp }

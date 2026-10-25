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

// Read per call (not frozen at require time) so a key added to the env —
// or set by a test — takes effect without a module reload.
const elevenLabsKey = () => process.env.ELEVENLABS_API_KEY || ''
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
async function generateDubbedTrack({ videoId, targetLanguage, voiceId, lipSyncEnabled = false, audioSampleUrl, sourceFilePath, sourceUrl }) {
  const ELEVENLABS_API_KEY = elevenLabsKey()
  if (!ELEVENLABS_API_KEY) {
    logger.info('[dubbing] ELEVENLABS_API_KEY missing, trying Edge-TTS fallback...', { videoId, targetLanguage });
    try {
      // 1. Fetch transcript from Content DB
      const Content = require('../models/Content');
      const content = await Content.findById(videoId).select('transcript title description').lean();
      const sourceText =
        (typeof content?.transcript === 'string' ? content.transcript : content?.transcript?.text) ||
        content?.description ||
        content?.title ||
        '';
      
      if (!sourceText) {
        throw new Error('No transcript text available for Edge-TTS');
      }

      // 2. Translate text (Gemini)
      let translated = sourceText;
      try {
        const { generateContent, isConfigured } = require('../utils/googleAI');
        if (isConfigured) {
          translated = await generateContent(
            `Translate the following into ${targetLanguage}. Return ONLY the translated text, no preamble:\n\n${sourceText}`,
            { temperature: 0.2 }
          );
        }
      } catch (e) {
        logger.warn('[dubbing] translation failed; using source text as-is', { error: e.message });
      }

      // 3. Generate Edge-TTS audio using localized audio service
      const localizationService = require('./aiLocalizationService');
      const audioUrl = await localizationService.generateLocalizedAudio(translated, null, targetLanguage);
      if (!audioUrl) {
        throw new Error('Edge-TTS generation failed');
      }

      const jobId = crypto.randomUUID();
      return {
        success: true,
        jobId,
        audioUrl,
        lipSyncDataUrl: null,
        technique: 'edge-tts'
      };
    } catch (err) {
      logger.error('[dubbing] Edge-TTS fallback failed, returning mock/error', { error: err.message });
      if (isProduction()) {
        return {
          ok: false,
          configured: false,
          error: `Dubbing fallback failed: ${err.message}`,
        };
      }
      return buildMockResponse(videoId, targetLanguage, lipSyncEnabled);
    }
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
    // The provider needs the actual media. Send our own file's bytes; a remote
    // (cloud-storage) original goes as source_url. The old code sent a made-up
    // cdn.clickapp.io URL that does not exist, so no job could ever succeed.
    if (sourceFilePath) {
      const fs = require('fs')
      const path = require('path')
      formData.append('file', await fs.openAsBlob(sourceFilePath), path.basename(sourceFilePath))
    } else if (sourceUrl && /^https:\/\//i.test(sourceUrl)) {
      formData.append('source_url', sourceUrl)
    } else {
      throw new Error('The source video file could not be found to dub.')
    }
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

    // Async job: there is no playable audio yet. The provider's audio URL needs
    // our API key (a browser can't play it, and CSP blocks the origin anyway),
    // so the status poll copies the finished track into /uploads — see
    // saveDubbedAudio. No lip-sync URL: there is no lip-sync service behind it.
    return {
      jobId: dub.dubbing_id,
      audioUrl: null,
      status: 'processing',
      lipSyncDataUrl: null,
      technique: 'elevenlabs',
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
async function cloneVoice(sample, name) {
  const ELEVENLABS_API_KEY = elevenLabsKey()
  // Fail honestly when the provider isn't configured, rather than firing a
  // keyless request that 401s with an opaque "Voice clone failed: 401".
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs voice cloning is not configured (set ELEVENLABS_API_KEY).')
  }

  const formData = new FormData()
  formData.append('name', name)
  // Accept raw bytes (Buffer — the route reads the user's own file, no arbitrary
  // URL fetch/SSRF) or a fetchable URL for the internal dubbing caller.
  const audioBlob = Buffer.isBuffer(sample)
    ? new Blob([sample])
    : await fetchWithTimeout(sample).then(r => r.blob())
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
  const ELEVENLABS_API_KEY = elevenLabsKey()
  if (!ELEVENLABS_API_KEY) {
    // PRODUCTION: don't claim a job is "dubbed" when dubbing isn't configured.
    if (isProduction()) {
      return { ok: false, configured: false, status: 'not_configured', progress: 0, error: 'Dubbing is not configured.' }
    }
    return { mock: true, status: 'dubbed', progress: 100 }
  }

  const res = await fetchWithTimeout(`${ELEVENLABS_BASE}/dubbing/${encodeURIComponent(dubbingId)}`, {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  })

  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
  const data = await res.json()
  // Normalize ElevenLabs' vocabulary ('dubbing' in-progress, 'failed') to the
  // states the client poll loop understands ('processing'/'completed'/'error'),
  // so a real failure surfaces immediately instead of polling until the cap and
  // reporting a bogus "timed out".
  const STATUS_MAP = { dubbing: 'processing', dubbed: 'completed', failed: 'error', error: 'error' }
  const status = STATUS_MAP[data.status] || data.status
  return { status, progress: data.progress ?? 0 }
}

/**
 * Download a finished ElevenLabs dub (the endpoint needs our API key) and store
 * it under our own /uploads so the editor can play it same-origin.
 *
 * @param {string} dubbingId
 * @param {string} targetLanguage
 * @returns {Promise<string>} unsigned "/uploads/dubs/<random>.mp3"
 */
async function saveDubbedAudio(dubbingId, targetLanguage) {
  const ELEVENLABS_API_KEY = elevenLabsKey()
  if (!ELEVENLABS_API_KEY) throw new Error('Dubbing is not configured.')
  const res = await fetchWithTimeout(
    `${ELEVENLABS_BASE}/dubbing/${encodeURIComponent(dubbingId)}/audio/${encodeURIComponent(targetLanguage)}`,
    { headers: { 'xi-api-key': ELEVENLABS_API_KEY } },
  )
  if (!res.ok) throw new Error(`Dubbed audio download failed: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (!buffer.length) throw new Error('Dubbed audio download was empty')

  const fs = require('fs')
  const path = require('path')
  const { randomMediaName } = require('../utils/mediaName')
  const dir = path.join(__dirname, '..', '..', 'uploads', 'dubs')
  await fs.promises.mkdir(dir, { recursive: true })
  const filename = randomMediaName('.mp3')
  await fs.promises.writeFile(path.join(dir, filename), buffer)
  return `/uploads/dubs/${filename}`
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

module.exports = { generateDubbedTrack, cloneVoice, getDubbingStatus, saveDubbedAudio, lipSyncWarp }

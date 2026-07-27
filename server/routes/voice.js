// Voice cloning + voice listing.
//
// POST /api/voice/clone  — clone a voice from the user's own uploaded sample,
//                          returning a voiceId usable in voiceover/dubbing.
// GET  /api/voice/voices — unified voice catalog (OpenAI stock + OmniVoice +
//                          ElevenLabs cloned voices) for a picker.
//
// Provider preference mirrors the rest of the voice stack: self-hosted OmniVoice
// when configured, else ElevenLabs. Cloning is inert (honest 503) until one is
// configured — it never fakes a voiceId.

const express = require('express');
const router = express.Router();
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { sendSuccess, sendError } = require('../utils/response');
const { toAbsolutePath } = require('../utils/pathUtils');
const logger = require('../utils/logger');

const MAX_SAMPLE_BYTES = 25 * 1024 * 1024; // 25MB — a reference recording is short
const NAME_MAX = 80;

/**
 * POST /api/voice/clone
 * Body: { audioSampleUrl: "/uploads/....(mp3|wav|m4a|ogg|webm|mp4)", name }
 */
router.post('/clone', authenticate, aiLimiter, async (req, res) => {
  try {
    const { audioSampleUrl, name } = req.body || {};

    const cleanName = String(name || '').trim();
    if (!cleanName) return sendError(res, 'A voice name is required', 400);
    if (cleanName.length > NAME_MAX) return sendError(res, `Voice name must be <= ${NAME_MAX} characters`, 400);
    if (!audioSampleUrl || typeof audioSampleUrl !== 'string') {
      return sendError(res, 'audioSampleUrl is required', 400);
    }

    // SSRF/LFI-safe: only the caller's own same-origin /uploads media, read as raw
    // bytes locally — we never fetch an arbitrary (possibly internal) URL. Strip a
    // same-origin scheme/host prefix, require an /uploads path, and let
    // toAbsolutePath contain it to <root>/uploads (returns null on traversal).
    const rel = audioSampleUrl.replace(/^https?:\/\/[^/]+/i, '');
    // Reject traversal up-front (defense in depth — toAbsolutePath also contains
    // it) so a malicious path gets a clear 400, not a confusing 404.
    if (rel.includes('..')) {
      return sendError(res, 'Invalid audioSampleUrl', 400);
    }
    if (!/^\/?uploads\/[\w./-]+\.(mp3|wav|m4a|ogg|webm|mp4)$/i.test(rel)) {
      return sendError(res, 'audioSampleUrl must be an /uploads audio path (mp3/wav/m4a/ogg/webm/mp4)', 400);
    }
    const abs = toAbsolutePath(rel);
    if (!abs || !fs.existsSync(abs)) return sendError(res, 'Reference audio not found', 404);

    const { size } = await fs.promises.stat(abs);
    if (size > MAX_SAMPLE_BYTES) return sendError(res, 'Reference audio is too large (max 25MB)', 400);
    if (size === 0) return sendError(res, 'Reference audio is empty', 400);
    const buffer = await fs.promises.readFile(abs);

    // Provider preference: self-hosted OmniVoice → ElevenLabs.
    const omniVoice = require('../services/omniVoiceService');
    let voiceId;
    let provider;
    if (omniVoice.isConfigured()) {
      voiceId = await omniVoice.cloneVoice(buffer, cleanName);
      provider = 'omnivoice';
    } else if (process.env.ELEVENLABS_API_KEY) {
      const { cloneVoice } = require('../services/aiGenerativeDubbingService');
      voiceId = await cloneVoice(buffer, cleanName);
      provider = 'elevenlabs';
    } else {
      return sendError(res, 'Voice cloning is not configured (set OMNIVOICE_BASE_URL or ELEVENLABS_API_KEY).', 503);
    }

    logger.info('[voice/clone] cloned', { userId: String(req.user?._id), provider });
    return sendSuccess(res, { voiceId, provider, name: cleanName }, 'Voice cloned successfully');
  } catch (error) {
    logger.error('[voice/clone] failed', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/voice/voices — unified voice catalog for a picker.
 */
router.get('/voices', authenticate, async (req, res) => {
  try {
    const { listVoices } = require('../services/aiVoiceoverService');
    const voices = await listVoices();
    return sendSuccess(res, { voices });
  } catch (error) {
    logger.error('[voice/voices] failed', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;

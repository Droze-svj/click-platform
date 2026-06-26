// AI music generation — POST /api/music/generate, GET /api/music/generate/:id
//
// Reuses the existing aiMusicGenerationService (Mubert / Soundraw provider flow,
// gated on an enabled AIMusicProviderConfig). HONEST: when no provider is configured
// it returns a clear 503 (never a fabricated track). Per-user isolated; rate-limited;
// inputs validated against the Music enums. Generation is async + paid, so POST starts
// a job and GET polls it, storing the categorized track on completion.

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const Music = require('../models/Music');
const { isDevUser } = require('../utils/devUser');
const { signMediaUrls } = require('../utils/mediaUrlSigner');
const logger = require('../utils/logger');

const router = express.Router();

const GENRES = Music.schema.path('genre').enumValues || [];
const MOODS = Music.schema.path('mood').enumValues || [];
const ENERGIES = ['low', 'medium', 'high'];

// The provider is "configured" only when an AIMusicProviderConfig is enabled.
async function enabledProvider() {
  try {
    const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');
    const cfg = await AIMusicProviderConfig.findOne({ enabled: true }).select('provider').lean();
    return cfg?.provider || null;
  } catch (_) {
    return null;
  }
}

router.post('/generate', auth, aiLimiter, asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return sendError(res, 'Authentication required', 401);
  if (isDevUser(userId)) return sendError(res, 'Music generation is unavailable for the demo user', 403);

  const provider = await enabledProvider();
  if (!provider) {
    // Honest cold path — no provider key/config → no fabricated track.
    return res.status(503).json({ success: false, reason: 'provider-not-configured', error: 'AI music generation is not configured on this server yet.' });
  }

  const clean = (v, allowed, d) => (typeof v === 'string' && allowed.includes(v) ? v : d);
  const params = {
    genre: clean(req.body.genre, GENRES, 'other'),
    mood: clean(req.body.mood, MOODS, 'energetic'),
    energy: clean(req.body.energy, ENERGIES, 'medium'),
    duration: Math.max(5, Math.min(180, parseInt(req.body.duration, 10) || 30)),
    prompt: typeof req.body.prompt === 'string' ? req.body.prompt.trim().slice(0, 300) : '',
  };

  try {
    const { generateMusicTrack } = require('../services/aiMusicGenerationService');
    const job = await generateMusicTrack(provider, params, userId);
    return sendSuccess(res, {
      provider,
      status: job.status || 'processing',
      generationId: String(job.generationId || ''),
      estimatedTime: job.estimatedTime ?? null,
      params,
    });
  } catch (e) {
    logger.error('[music-generate] start failed', { error: e.message, userId: String(userId) });
    return sendError(res, 'Music generation failed to start', 502);
  }
}));

router.get('/generate/:id', auth, asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId || isDevUser(userId)) return sendError(res, 'Generation not found', 404);
  const id = String(req.params.id || '');

  let gen;
  try {
    const MusicGeneration = require('../models/MusicGeneration');
    // Per-user isolation: a user can only poll their OWN generation.
    gen = await MusicGeneration.findOne({ _id: id, userId }).lean();
  } catch (_) {
    return sendError(res, 'Generation not found', 404);
  }
  if (!gen) return sendError(res, 'Generation not found', 404);

  try {
    const svc = require('../services/aiMusicGenerationService');
    const status = await svc.checkGenerationStatus(gen._id);
    if (status && status.status === 'completed') {
      const track = await svc.downloadAndStoreTrack(gen._id, userId);
      if (track && track._id) {
        // Best-effort: stamp organized-catalog facets from the generation params.
        try {
          await Music.updateOne(
            { _id: track._id, userId },
            { $set: { energy: gen.params?.energy || 'medium', usageContext: ['background'], vocals: 'instrumental' } },
          );
        } catch (_) { /* non-fatal */ }
      }
      return sendSuccess(res, { status: 'completed', track: track ? signMediaUrls(track) : null });
    }
    return sendSuccess(res, { status: (status && status.status) || gen.status || 'processing' });
  } catch (e) {
    logger.warn('[music-generate] status check failed', { error: e.message });
    return sendError(res, 'Failed to check generation', 502);
  }
}));

module.exports = router;

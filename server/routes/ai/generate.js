/**
 * Unified AI asset generation for the editor's "Generate" panel.
 *
 *   GET  /api/ai/generate/capabilities   what can be generated (per configured keys)
 *   POST /api/ai/generate                { kind: 'voiceover'|'sfx'|'image', ...params }
 *
 * Every generator degrades honestly: an unconfigured provider returns 503 with
 * { unavailable:true } (the UI shows "configure a provider"), never a crash.
 * Metered by the monthly AI-generation quota (checkGenerationQuota); the source
 * provider's own cost applies when keys are configured.
 */

const express = require('express');

const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { aiLimiter } = require('../../middleware/enhancedRateLimiter');
const { checkGenerationQuota } = require('../../middleware/tierGate');
const { sendSuccess, sendError } = require('../../utils/response');
const usageService = require('../../services/usageService');
const generationService = require('../../services/generationService');

const router = express.Router();

const KINDS = ['voiceover', 'sfx', 'image'];

router.get(
  '/capabilities',
  auth,
  asyncHandler(async (req, res) => sendSuccess(res, { capabilities: generationService.getCapabilities() }))
);

router.post(
  '/',
  auth,
  aiLimiter,
  checkGenerationQuota,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const kind = String(body.kind || '').toLowerCase();
    if (!KINDS.includes(kind)) {
      return sendError(res, `kind must be one of: ${KINDS.join(', ')}`, 400);
    }

    const userId = req.user?._id || req.user?.id;
    const result = await generationService.generate(kind, {
      userId,
      text: body.text,
      prompt: body.prompt,
      style: body.style,
      durationSeconds: typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined,
      aspectRatio: typeof body.aspectRatio === 'string' ? body.aspectRatio : undefined,
      voice: body.voice,
      voiceId: body.voiceId,
      speed: typeof body.speed === 'number' ? body.speed : undefined,
      videoId: body.videoId,
    });

    if (!result.ok) {
      // 503 when a provider simply isn't configured (actionable), 400 otherwise.
      const status = result.unavailable ? 503 : 400;
      return res.status(status).json({ success: false, error: result.error, unavailable: !!result.unavailable });
    }

    // Meter the successful generation against the monthly quota (best-effort).
    if (userId) usageService.incrementUsage(userId, 'contentGenerated').catch(() => {});

    return sendSuccess(res, { asset: result.asset });
  })
);

module.exports = router;

/**
 * POST /api/ai/hooks/ensemble — multi-LLM hook generation + auto-A/B
 * registration. Returns the scored candidate list and the registered test.
 *
 * Cost-guarded: estimates spend across three providers before fanning out;
 * 402 with structured payload when budget is exhausted.
 */

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { costGuard } = require('../middleware/costGuard');
const hookEnsembleService = require('../services/hookEnsembleService');

const router = express.Router();

router.post(
  '/ensemble',
  auth,
  costGuard(),
  asyncHandler(async (req, res) => {
    const { topic, niche, platform, topK = 4, projectId, register = true } = req.body || {};
    const userId = req.user?.id || req.user?._id?.toString();
    if (!userId) return sendError(res, 'Unauthenticated', 401);

    // Pre-check budget for the worst-case 3-way fan out (~3 × 600 output tokens).
    try {
      await req.assertBudget({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        prompt: `${topic || ''} ${niche || ''} ${platform || ''}`,
        expectedOutputTokens: 1800,
      });
    } catch (e) {
      if (e.statusCode === 402) {
        return res.status(402).json({ success: false, error: e.message, ...e.payload });
      }
      throw e;
    }

    const result = register
      ? await hookEnsembleService.generateHooksAndRegisterTest({
        userId,
        topic,
        niche,
        platform,
        topK,
        projectId,
      })
      : await hookEnsembleService.generateHooks({ userId, topic, niche, platform, topK });

    return sendSuccess(res, result);
  })
);

module.exports = router;

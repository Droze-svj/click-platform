// Viral suggestion + multi-platform reformat routes.
//
// POST /api/video/viral/one-click — runs all 5 stages of the viral
//   pipeline (hook / pattern interrupts / b-roll / beat sync / CTA) and
//   returns a list of AIDirectorSuggestion records the editor's
//   useTimelineActions can apply individually or all at once.
//
// POST /api/video/reformat — adapts one video to N target platforms with
//   per-platform crop plans + niche-tuned copy (TikTok punchy 3s hook,
//   LinkedIn analytical opener, etc.).

const express = require('express');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const { runOneClickViral } = require('../../services/oneClickViralService');
const { reformatToPlatforms } = require('../../services/reformatService');
const logger = require('../../utils/logger');

const { aiLimiter } = require('../../middleware/enhancedRateLimiter');
const { costGuard } = require('../../middleware/costGuard');

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'POST') return aiLimiter(req, res, next);
  return next();
});

router.use(costGuard());

router.post('/one-click', auth, asyncHandler(async (req, res) => {
  const { contentId, niche, platform, language, targetLanguage } = req.body || {};
  if (!contentId) return sendError(res, 'contentId is required', 400);
  try {
    const result = await runOneClickViral(contentId, {
      user: req.user,
      niche,
      platform,
      language: targetLanguage || language || 'English',
    });
    if (!result.ok) return sendError(res, result.error || 'viral-pipeline-failed', 422);
    return sendSuccess(res, 'One-click viral plan ready', 200, result);
  } catch (err) {
    logger.error('[viral/one-click] failed', { error: err.message, contentId });
    return sendError(res, 'one-click-viral-failed', 500);
  }
}));

router.post('/reformat', auth, asyncHandler(async (req, res) => {
  const { contentId, targets, niche, language } = req.body || {};
  if (!contentId) return sendError(res, 'contentId is required', 400);
  if (!Array.isArray(targets) || targets.length === 0) {
    return sendError(res, 'targets must be a non-empty array of platform names', 400);
  }
  try {
    const result = await reformatToPlatforms(contentId, targets, { niche, language });
    if (!result.ok) return sendError(res, result.error || 'reformat-failed', 422);
    return sendSuccess(res, 'Reformat plan ready', 200, result);
  } catch (err) {
    logger.error('[viral/reformat] failed', { error: err.message, contentId });
    return sendError(res, 'reformat-failed', 500);
  }
}));

module.exports = router;

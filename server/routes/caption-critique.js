// Caption Critique route
// POST /api/critique — score a caption/script's copy with actionable fixes.

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { costGuard } = require('../middleware/costGuard');
const { capForPrompt } = require('../utils/promptSafe');
const { guardOwnership } = require('../utils/ownership');
const googleAI = require('../utils/googleAI');
const { critiquePost } = require('../services/captionCritiqueService');

/**
 * POST /api/critique
 * Body: { contentId?, text?, platform? }
 * Provide either a `contentId` (must be owned) or raw `text`.
 */
router.post('/', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const platform = body.platform ? String(body.platform) : 'instagram';

  let text = body.text ? String(body.text) : '';
  if (body.contentId) {
    const content = await guardOwnership(req, res, body.contentId);
    if (!content) return undefined;
    text = (content.content && content.content.text) || content.description || text;
  }
  if (!text || !text.trim()) {
    return sendError(res, 'Provide contentId or non-empty text', 400);
  }

  const deps = {
    sanitize: capForPrompt,
    generate: (prompt, opts) => googleAI.generateContent(prompt, opts),
    assertBudget: (args) => req.assertBudget(args),
    recordUsage: (args) => req.recordAiUsage(args),
  };

  let result;
  try {
    result = await critiquePost({ platform, text }, deps);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
  return sendSuccess(res, 'Critique generated', 200, result);
}));

module.exports = router;

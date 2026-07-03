// First-Comment Generator route
// POST /api/first-comment — draft pinned first-comment options for a post.

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
const { generateFirstComments, GOALS } = require('../services/firstCommentService');

/**
 * POST /api/first-comment
 * Body: { contentId?, text?, platform?, goal? }  (goal: engagement | cta | link)
 * Provide either a `contentId` (must be owned) or raw post `text`.
 */
router.post('/', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const platform = body.platform ? String(body.platform) : 'instagram';
  const goal = GOALS[body.goal] ? body.goal : 'engagement';

  let sourceText = body.text ? String(body.text) : '';
  if (body.contentId) {
    const content = await guardOwnership(req, res, body.contentId);
    if (!content) return undefined;
    sourceText = (content.content && content.content.text) || content.description || sourceText;
  }
  if (!sourceText || !sourceText.trim()) {
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
    result = await generateFirstComments({ platform, goal, sourceText }, deps);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
  return sendSuccess(res, 'First-comment options generated', 200, result);
}));

module.exports = router;

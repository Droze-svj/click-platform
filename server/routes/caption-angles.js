// Caption Angles route
// POST /api/captions — draft a few distinct-angle caption options for a topic.

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
const { generateCaptions } = require('../services/captionAnglesService');

/**
 * POST /api/captions
 * Body: { contentId?, topic?, platform?, count? }
 * Provide either a `contentId` (must be owned) or a raw `topic`.
 */
router.post('/', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const platform = body.platform ? String(body.platform) : 'instagram';

  let topic = body.topic ? String(body.topic) : '';
  if (body.contentId) {
    const content = await guardOwnership(req, res, body.contentId);
    if (!content) return undefined;
    topic = (content.content && content.content.text) || content.description || topic;
  }
  if (!topic || !topic.trim()) {
    return sendError(res, 'Provide contentId or a non-empty topic', 400);
  }

  const deps = {
    sanitize: capForPrompt,
    generate: (prompt, opts) => googleAI.generateContent(prompt, opts),
    assertBudget: (args) => req.assertBudget(args),
    recordUsage: (args) => req.recordAiUsage(args),
  };

  // `exclude`: captions already shown (regenerate) → produce different angles.
  const exclude = Array.isArray(body.exclude) ? body.exclude.slice(0, 40).map((x) => (x && x.text) || String(x || '')) : [];

  let result;
  try {
    result = await generateCaptions({ platform, topic, count: body.count, exclude }, deps);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
  return sendSuccess(res, 'Captions generated', 200, result);
}));

module.exports = router;

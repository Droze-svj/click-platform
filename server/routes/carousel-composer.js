// Carousel / Thread Composer route
// POST /api/carousel — split one idea into ordered carousel slides / thread posts.

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
const { composeSlides, FORMATS, normalizeFormat } = require('../services/carouselComposerService');

/**
 * POST /api/carousel
 * Body: { contentId?, topic?, format?, count? }  (format: carousel | thread)
 * Provide either a `contentId` (must be owned) or a raw `topic`.
 */
router.post('/', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const format = FORMATS[body.format] ? body.format : normalizeFormat(body.format);

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

  let result;
  try {
    result = await composeSlides({ format, topic, count: body.count }, deps);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
  return sendSuccess(res, 'Slides composed', 200, result);
}));

module.exports = router;

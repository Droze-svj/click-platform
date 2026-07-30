// Hook Generator route
// POST /api/hooks — draft scroll-stopping opening hooks for a post/topic.

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
const personalizationService = require('../services/personalizationService');
const { generateHooks, STYLES, normalizeStyle } = require('../services/hookGeneratorService');

/**
 * POST /api/hooks
 * Body: { contentId?, topic?, platform?, style?, count? }
 * Provide either a `contentId` (must be owned) or a raw `topic`.
 */
router.post('/', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const platform = body.platform ? String(body.platform) : 'instagram';
  const style = STYLES[body.style] ? body.style : normalizeStyle(body.style);

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
    buildSystemPrompt: (args) => personalizationService.buildPersonalizedSystemPrompt(args),
  };

  // `exclude`: hooks already shown to the user (e.g. on "regenerate") so the model
  // produces genuinely different ones. Bounded + string-coerced. Merge in the
  // server-remembered recents (cross-call dedup) so a fresh session still avoids
  // repeats even when the client sends no exclude list.
  const clientExclude = Array.isArray(body.exclude) ? body.exclude.slice(0, 40).map((x) => String(x || '')) : [];
  const genHistory = require('../services/generationHistoryService');
  const recalled = await genHistory.recentExclude(req.user._id, 'hooks');
  const exclude = [...clientExclude, ...recalled];

  let result;
  try {
    result = await generateHooks({ platform, style, topic, count: body.count, exclude, userId: req.user._id }, deps);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
  // Remember what we just showed so future calls dedup against it.
  await genHistory.recordOutputs(req.user._id, 'hooks', (result.hooks || []).map((h) => h.text));
  return sendSuccess(res, 'Hooks generated', 200, result);
}));

module.exports = router;

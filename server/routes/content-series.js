// Content Series Planner route
// POST /api/series — plan a coherent multi-part series; optionally schedule it
// as ordered calendar drafts.

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { costGuard } = require('../middleware/costGuard');
const { capForPrompt } = require('../utils/promptSafe');
const User = require('../models/User');
const googleAI = require('../utils/googleAI');
const { generateSeries, seriesToIdeas } = require('../services/contentSeriesService');
const { createCalendarDrafts } = require('../services/calendarAutofillService');

/**
 * POST /api/series
 * Body: { theme, parts?, platform?, schedule?, cadenceHours? }
 * Plans a connected series from a theme. When schedule=true, the parts are also
 * created as ordered pending_approval calendar drafts.
 */
router.post('/', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.theme || !String(body.theme).trim()) {
    return sendError(res, 'theme is required', 400);
  }
  const platform = body.platform ? String(body.platform) : 'tiktok';

  const user = await User.findById(req.user._id).select('niche').lean();
  const niche = (user && user.niche) || 'other';

  const deps = {
    sanitize: capForPrompt,
    generate: (prompt, opts) => googleAI.generateContent(prompt, opts),
    assertBudget: (args) => req.assertBudget(args),
    recordUsage: (args) => req.recordAiUsage(args),
  };

  let series;
  try {
    series = await generateSeries({ theme: body.theme, niche, parts: body.parts, platform }, deps);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }

  const result = { ...series };

  if (body.schedule && series.parts.length) {
    const ideas = seriesToIdeas(series.parts, platform);
    const drafts = await createCalendarDrafts(req.user._id, ideas, {
      platforms: [platform],
      niche,
      cadenceHours: body.cadenceHours,
      dryRun: !!body.dryRun,
    });
    result.scheduled = { planId: drafts.planId, count: drafts.count };
  }

  return sendSuccess(res, 'Series planned', 200, result);
}));

module.exports = router;

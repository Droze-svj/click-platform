// Content Calendar Autofill routes
// One click drafts a week/month of AI content ideas as pending_approval
// ScheduledPosts; the creator reviews them and approves (→ scheduled) or cancels.

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { costGuard } = require('../middleware/costGuard');
const { clampInt } = require('../utils/pagination');
const User = require('../models/User');
const aiService = require('../services/aiService');
const {
  createCalendarDrafts,
  listCalendarDrafts,
  approveCalendarPlan,
  cancelCalendarPlan,
} = require('../services/calendarAutofillService');

/**
 * POST /api/calendar/autofill
 * Generate `count` AI ideas from the caller's niche (or a supplied topic) and
 * create them as pending_approval drafts spread across future slots.
 * Body: { count?, platforms?, topic?, startAt?, cadenceHours?, dryRun? }
 */
router.post('/autofill', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  // Each idea is one paid Gemini generation batched into a single call, but the
  // draft fan-out is bounded so a caller can't stuff the calendar/DB.
  const count = clampInt(body.count, 7, 30, 1);
  const cadenceHours = clampInt(body.cadenceHours, 24, 168, 1);
  const platforms = Array.isArray(body.platforms) ? body.platforms : ['tiktok'];

  const user = await User.findById(req.user._id).select('niche').lean();
  const niche = user?.niche || 'other';
  const subject = body.topic ? String(body.topic).slice(0, 500) : niche;

  const prompt = `Generate ${count} calendar content ideas for the ${niche} niche about "${subject}".`;
  try {
    await req.assertBudget({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      prompt,
      expectedOutputTokens: 1200,
    });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 402);
  }

  const ideas = await aiService.generateViralIdeas(subject, niche, count);

  // Meter the real spend (settles the reservation when atomic-reserve is on).
  await req.recordAiUsage({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    inputTokens: Math.ceil(prompt.length / 4),
    outputTokens: 1200,
    taskType: 'calendar-autofill',
  });

  const startMs = body.startAt ? new Date(body.startAt).getTime() : NaN;
  const result = await createCalendarDrafts(req.user._id, ideas, {
    platforms,
    niche,
    startAt: Number.isFinite(startMs) ? startMs : undefined,
    cadenceHours,
    dryRun: !!body.dryRun,
  });

  sendSuccess(res, 'Calendar drafts created', 201, result);
}));

/**
 * GET /api/calendar/drafts?limit=&skip=
 * List the caller's pending autofill drafts (paginated).
 */
router.get('/drafts', auth, asyncHandler(async (req, res) => {
  const limit = clampInt(req.query.limit, 50, 200, 1);
  const skip = clampInt(req.query.skip, 0, 1000000, 0);
  const drafts = await listCalendarDrafts(req.user._id, { limit, skip });
  sendSuccess(res, 'Calendar drafts retrieved', 200, { drafts });
}));

/**
 * POST /api/calendar/plans/:planId/approve
 * Flip a plan's pending drafts to scheduled (they will publish at their slots).
 */
router.post('/plans/:planId/approve', auth, asyncHandler(async (req, res) => {
  const result = await approveCalendarPlan(req.user._id, req.params.planId);
  sendSuccess(res, 'Calendar plan approved', 200, result);
}));

/**
 * POST /api/calendar/plans/:planId/cancel
 * Cancel a plan's pending drafts.
 */
router.post('/plans/:planId/cancel', auth, asyncHandler(async (req, res) => {
  const result = await cancelCalendarPlan(req.user._id, req.params.planId);
  sendSuccess(res, 'Calendar plan cancelled', 200, result);
}));

module.exports = router;

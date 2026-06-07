// AI Director routes — mounted under /api/ai/director.
//
// Slice 1: POST /plan — generate 2–3 creative edit directions for a video,
// powered by Claude Opus 4.8 and grounded in the creator's real learned style.

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const { guardOwnership } = require('../../utils/ownership');
const logger = require('../../utils/logger');
const { generateEditPlan } = require('../../services/aiDirectorService');
const UserStyleProfile = require('../../models/UserStyleProfile');
const SuggestionFeedback = require('../../models/SuggestionFeedback');
const EditPlanMemory = require('../../models/EditPlanMemory');

// M6: resolve a single canonical user id and cast to ObjectId once when it's a
// valid ObjectId string, so every handler + downstream query (aiDirectorService,
// EditPlanMemory) keys off the same value/type.
function resolveUserId(req) {
  const raw = req.user?._id || req.user?.id;
  if (!raw) return raw;
  if (raw instanceof mongoose.Types.ObjectId) return raw;
  const str = String(raw);
  return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : raw;
}

// ── POST /api/ai/director/plan ────────────────────────────────────────────
// Body: { contentId, goals?, constraints? }
// Auth + ownership protected (reuses guardOwnership from routes/video/ai-editing.js).
router.post('/plan', auth, asyncHandler(async (req, res) => {
  const { contentId, goals = {}, constraints = {} } = req.body || {};

  if (!contentId) {
    return sendError(res, 'contentId is required', 400);
  }

  // Ownership gate — a plan reveals the project's transcript-derived structure
  // and the creator's learned style; refuse for content the requester doesn't
  // own. guardOwnership sends its own 400/403/404 and returns null on failure.
  const owned = await guardOwnership(req, res, contentId);
  if (!owned) return;

  const userId = resolveUserId(req);

  try {
    const result = await generateEditPlan({ contentId, userId, goals, constraints });

    if (!result.ok) {
      // Honest failure (no key, no transcript, parse failure, etc.) — surface
      // it as a 200 with success:false so the client can show a real message
      // rather than treating it as a hard error.
      return res.status(200).json({ success: false, error: result.error });
    }

    return sendSuccess(res, 'AI Director plan ready', 200, {
      directions: result.directions,
      meta: result.meta,
    });
  } catch (e) {
    logger.error('[AIDirector] /plan failed', { error: e.message });
    return sendError(res, e.message || 'Failed to generate edit plan', 500);
  }
}));

// ── POST /api/ai/director/feedback ────────────────────────────────────────
// Body: { contentId, directionId, action, step? }
//   action ∈ choose_direction | apply_step | skip_step | dismiss_direction | tweak_step
//   step   = { type, value? }  (optional; describes the acted-on step)
//     value = the CATEGORICAL value used for learning (transition style, color
//             grade, caption style, pacing strategy, hook style). NEVER a param
//             NAME, NEVER freeform hook copy. Omitted when there's no categorical
//             value.
//
// Drives the learning loop: always logs a SuggestionFeedback row, nudges the
// creator's UserStyleProfile weighted facets, and flips the EditPlanMemory
// status. Every side-effect is best-effort and isolated so one failure can't
// 500 the others — but we never fabricate: if a step has no resolvable
// facet+value, we simply skip the profile nudge rather than invent one.

// action → SuggestionFeedback.signal. (tweak counts as positive intent —
// the creator engaged with the step — with the tweak noted in metadata.)
const ACTION_SIGNAL = {
  choose_direction: 'positive',
  apply_step: 'positive',
  tweak_step: 'positive',
  skip_step: 'negative',
  dismiss_direction: 'dismiss',
};

// step.type → SuggestionFeedback.facet enum value
// (enum: transition | caption | pacing | overlay | music | cut | other).
const STEP_FEEDBACK_FACET = {
  transition: 'transition',
  caption: 'caption',
  pacing: 'pacing',
  cut: 'cut',
  broll: 'overlay',
  audio: 'music',
  hook: 'other',
  color: 'other',
  effect: 'other',
  cta: 'other',
};

// step.type → { facet (plain pick), weighted (perf-weighted) } on UserStyleProfile.
const STEP_STYLE_FACET = {
  color: { facet: 'colorGrades', weighted: 'weightedColorGrades' },
  transition: { facet: 'transitions', weighted: 'weightedTransitions' },
  hook: { facet: 'hookStyles', weighted: 'weightedHooks' },
  caption: { facet: 'captionStyles', weighted: 'weightedCaptionStyles' },
  pacing: { facet: null, weighted: 'weightedPacing' }, // no plain 'pacing' facet on profile
};

const POSITIVE_NUDGE = 0.3;
const NEGATIVE_NUDGE = -0.2;

// H3 guard: tokens that are param NAMES (or generic noise), never categorical
// learning values. If step.value matches one of these it's client garbage —
// we must NOT learn it as a style key.
const PARAM_NAME_TOKENS = new Set([
  'text', 'keyword', 'duration', 'time', 'grade', 'style', 'strategy', 'speed',
  'start', 'end', 'name', 'action', 'reason',
]);

// A usable categorical learning value: a non-empty string that isn't a param-name token.
function categoricalValue(step) {
  const v = step && typeof step.value === 'string' ? step.value.trim() : '';
  if (!v) return null;
  if (PARAM_NAME_TOKENS.has(v.toLowerCase())) return null;
  return v;
}

router.post('/feedback', auth, asyncHandler(async (req, res) => {
  const { contentId, directionId, action, step } = req.body || {};

  if (!contentId) return sendError(res, 'contentId is required', 400);
  if (!directionId) return sendError(res, 'directionId is required', 400);
  if (!action || !ACTION_SIGNAL[action]) {
    return sendError(res, 'action must be one of: choose_direction, apply_step, skip_step, dismiss_direction, tweak_step', 400);
  }

  // Ownership gate — identical to /plan.
  const owned = await guardOwnership(req, res, contentId);
  if (!owned) return;

  const userId = resolveUserId(req); // M6
  const signal = ACTION_SIGNAL[action];
  const stepType = step && typeof step.type === 'string' ? step.type : null;
  // H3: the learning key is the CATEGORICAL value (transition style / color
  // grade / caption style / pacing strategy / hook style) — NOT a param name,
  // NOT freeform hook copy. categoricalValue() drops empty + param-name garbage.
  const stepValue = categoricalValue(step);

  // 1. Always log a SuggestionFeedback row (best-effort).
  try {
    const facet = (stepType && STEP_FEEDBACK_FACET[stepType])
      || (step && typeof step.facet === 'string' && step.facet)
      || 'other';
    await SuggestionFeedback.create({
      userId,
      suggestionId: directionId,
      facet,
      // key is required; use the categorical value, fall back to directionId.
      key: stepValue || directionId,
      signal,
      contentId,
      metadata: { action, directionId, step: step || null },
    });
  } catch (err) {
    logger.warn('[AIDirector] feedback log failed', { error: err.message });
  }

  // 2. Nudge the creator's UserStyleProfile when the step maps to a known
  //    style facet AND carries a real categorical value. Positive actions
  //    upweight; skip/dismiss downweight. The PARAM_NAME_TOKENS guard inside
  //    categoricalValue() ensures a param-name can never become a learned key.
  if (stepType && stepValue && STEP_STYLE_FACET[stepType]) {
    const { facet, weighted } = STEP_STYLE_FACET[stepType];
    const positive = action === 'apply_step' || action === 'choose_direction' || action === 'tweak_step';
    const isDown = action === 'skip_step' || action === 'dismiss_direction';
    try {
      if (positive && facet) {
        await UserStyleProfile.recordPick(userId, facet, stepValue);
      }
      if (positive) {
        await UserStyleProfile.recordPerformance(userId, weighted, stepValue, POSITIVE_NUDGE);
      } else if (isDown) {
        await UserStyleProfile.recordPerformance(userId, weighted, stepValue, NEGATIVE_NUDGE);
      }
    } catch (err) {
      logger.warn('[AIDirector] style profile nudge failed', { error: err.message });
    }
  }

  // 3. Flip EditPlanMemory status for choose/dismiss (best-effort).
  if (action === 'choose_direction' || action === 'dismiss_direction') {
    const newStatus = action === 'choose_direction' ? 'chosen' : 'dismissed';
    try {
      await EditPlanMemory.markStatus(userId, directionId, newStatus);
    } catch (err) {
      logger.warn('[AIDirector] markStatus failed', { error: err.message });
    }
  }

  return sendSuccess(res, 'Feedback recorded', 200, { success: true });
}));

module.exports = router;

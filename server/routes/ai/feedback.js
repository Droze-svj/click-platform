// POST /api/ai/feedback — universal AI feedback for EVERY surface (captions,
// hooks, clips, ideas, scripts, music, smart-publish defaults). One endpoint that
// closes the learning loop: positive feedback upweights the trait, negative /
// regenerate / heavy-edit downweights it AND records the mistake reason so the
// next personalized prompt can avoid it. See services/aiFeedbackService.js.

const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const aiFeedbackService = require('../../services/aiFeedbackService');

router.post('/', auth, asyncHandler(async (req, res) => {
  const { surface, itemType, action, value, reason, contentId, magnitude } = req.body || {};
  if (!action) return sendError(res, 'action is required (accept|reject|thumbs_up|thumbs_down|regenerate|edit|dismiss)', 400);

  const userId = req.user?._id || req.user?.id;
  const result = await aiFeedbackService.recordFeedback({
    userId, surface, itemType, action, value, reason, contentId, magnitude,
  });
  if (!result.ok) return sendError(res, result.error || 'Could not record feedback', 400);
  return sendSuccess(res, 'Feedback recorded', 200, result);
}));

module.exports = router;

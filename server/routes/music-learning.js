// Music Learning Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  recordSuggestionFeedback,
  getUserMusicPreferences,
  getSuggestionStatistics
} = require('../services/musicLearningService');
const router = express.Router();

/**
 * @route POST /api/music/learning/feedback
 * @desc Record user feedback on suggestions
 * @access Private
 */
router.post('/learning/feedback', auth, asyncHandler(async (req, res) => {
  const {
    contentId,
    suggestionId,
    suggestionSource,
    action,
    videoContext,
    suggestionDetails,
    outcome
  } = req.body;

  if (!contentId || !suggestionId || !action) {
    return sendError(res, 'contentId, suggestionId, and action are required', 400);
  }

  try {
    const feedback = await recordSuggestionFeedback({
      contentId,
      suggestionId,
      suggestionSource,
      action,
      videoContext,
      suggestionDetails,
      outcome
    }, req.user._id);

    sendSuccess(res, 'Feedback recorded', 200, { feedback });
  } catch (error) {
    logger.error('Error recording feedback', { error: error.message });
    sendError(res, error.message || 'Failed to record feedback', 500);
  }
}));

/**
 * @route GET /api/music/learning/preferences
 * @desc Get user music preferences
 * @access Private
 */
router.get('/learning/preferences', auth, asyncHandler(async (req, res) => {
  const { minSelections = 5, lookbackDays = 90 } = req.query;

  try {
    const preferences = await getUserMusicPreferences(req.user._id, {
      minSelections: parseInt(minSelections),
      lookbackDays: parseInt(lookbackDays)
    });

    sendSuccess(res, 'Preferences retrieved', 200, { preferences });
  } catch (error) {
    logger.error('Error getting preferences', { error: error.message });
    sendError(res, error.message || 'Failed to get preferences', 500);
  }
}));

/**
 * @route GET /api/music/learning/statistics
 * @desc Get suggestion statistics
 * @access Private
 */
router.get('/learning/statistics', auth, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const stats = await getSuggestionStatistics(req.user._id, {
      startDate,
      endDate
    });

    sendSuccess(res, 'Statistics retrieved', 200, { statistics: stats });
  } catch (error) {
    logger.error('Error getting statistics', { error: error.message });
    sendError(res, error.message || 'Failed to get statistics', 500);
  }
}));

module.exports = router;








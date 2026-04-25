// AI Soundtrack Suggestions Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { suggestSoundtracks } = require('../services/aiSoundtrackSuggestionService');
const router = express.Router();

/**
 * @route POST /api/music/ai-suggestions
 * @desc Get AI soundtrack suggestions for video
 * @access Private
 */
router.post('/ai-suggestions', auth, asyncHandler(async (req, res) => {
  const {
    contentId,
    platform = 'youtube',
    count = 5,
    includeExistingTracks = true,
    includeAIGenerated = true
  } = req.body;

  if (!contentId) {
    return sendError(res, 'contentId is required', 400);
  }

  try {
    const suggestions = await suggestSoundtracks(
      contentId,
      req.user._id,
      {
        platform,
        count: parseInt(count),
        includeExistingTracks: includeExistingTracks !== false,
        includeAIGenerated: includeAIGenerated !== false
      }
    );

    sendSuccess(res, 'AI suggestions generated', 200, suggestions);
  } catch (error) {
    logger.error('Error generating AI suggestions', {
      error: error.message,
      contentId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to generate suggestions', 500);
  }
}));

module.exports = router;








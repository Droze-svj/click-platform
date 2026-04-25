// Advanced Audio Feature Extraction Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { extractAudioFeatures } = require('../../services/advancedAudioFeatureExtraction');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/audio-features
 * @desc Extract advanced audio features from video
 * @access Private
 */
router.post('/audio-features', auth, asyncHandler(async (req, res) => {
  const { videoUrl, videoId, windowSize, hopSize, aggregateByShots, shotBoundaries } = req.body;

  if (!videoUrl && !videoId) {
    return sendError(res, 'Either videoUrl or videoId is required', 400);
  }

  try {
    const { getVideoFilePath } = require('../../services/sceneDetectionService');
    const videoPath = await getVideoFilePath(videoId || videoUrl);

    const features = await extractAudioFeatures(videoPath, {
      windowSize: windowSize || 0.5,
      hopSize: hopSize || 0.25,
      aggregateByShots: aggregateByShots !== false,
      shotBoundaries: shotBoundaries || []
    });

    sendSuccess(res, 'Audio features extracted successfully', 200, features);
  } catch (error) {
    logger.error('Error extracting audio features', { error: error.message });
    sendError(res, error.message || 'Failed to extract audio features', 500);
  }
}));

module.exports = router;








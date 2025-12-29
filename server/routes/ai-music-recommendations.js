// AI Music Recommendations Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  recommendMusicForScene,
  recommendMusicForScenes,
  recommendMusicForVideo
} = require('../services/aiMusicRecommendationService');
const { generateMusicTrack } = require('../services/aiMusicGenerationService');
const router = express.Router();

/**
 * @route POST /api/ai-music/recommend/scene/:sceneId
 * @desc Get music recommendations for a scene
 * @access Private
 */
router.post('/recommend/scene/:sceneId', auth, asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { autoGenerate = false, provider } = req.body;

  try {
    const recommendations = await recommendMusicForScene(sceneId, req.user._id);

    let generation = null;
    if (autoGenerate) {
      // Auto-generate music with recommendations
      const genProvider = provider || recommendations.provider;
      generation = await generateMusicTrack(
        genProvider,
        recommendations,
        req.user._id
      );
    }

    sendSuccess(res, 'Recommendations retrieved', 200, {
      recommendations,
      generation
    });
  } catch (error) {
    logger.error('Error getting scene recommendations', {
      error: error.message,
      sceneId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get recommendations', 500);
  }
}));

/**
 * @route POST /api/ai-music/recommend/scenes
 * @desc Get music recommendations for multiple scenes
 * @access Private
 */
router.post('/recommend/scenes', auth, asyncHandler(async (req, res) => {
  const { sceneIds } = req.body;

  if (!sceneIds || !Array.isArray(sceneIds)) {
    return sendError(res, 'sceneIds array is required', 400);
  }

  try {
    const recommendations = await recommendMusicForScenes(sceneIds, req.user._id);

    sendSuccess(res, 'Recommendations retrieved', 200, { recommendations });
  } catch (error) {
    logger.error('Error getting scenes recommendations', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get recommendations', 500);
  }
}));

/**
 * @route POST /api/ai-music/recommend/video
 * @desc Get music recommendations for video metadata
 * @access Private
 */
router.post('/recommend/video', auth, asyncHandler(async (req, res) => {
  const { videoMetadata, autoGenerate = false, provider } = req.body;

  if (!videoMetadata) {
    return sendError(res, 'videoMetadata is required', 400);
  }

  try {
    const { recommendMusicForVideo } = require('../services/aiMusicRecommendationService');
    const recommendations = recommendMusicForVideo(videoMetadata);

    let generation = null;
    if (autoGenerate) {
      const genProvider = provider || 'mubert';
      generation = await generateMusicTrack(
        genProvider,
        recommendations,
        req.user._id
      );
    }

    sendSuccess(res, 'Recommendations retrieved', 200, {
      recommendations,
      generation
    });
  } catch (error) {
    logger.error('Error getting video recommendations', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get recommendations', 500);
  }
}));

module.exports = router;








// Scene Quality and Ranking Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  scoreSceneQuality,
  rankScenesByQuality,
  filterScenesByQuality
} = require('../../services/sceneQualityService');
const { getScenesForAsset } = require('../../services/sceneDetectionService');
const Scene = require('../../models/Scene');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route GET /api/video/scenes/:contentId/quality
 * @desc Get quality scores for all scenes
 * @access Private
 */
router.get('/:contentId/quality', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { minScore, optimalDuration } = req.query;

  try {
    const scenesResult = await getScenesForAsset(contentId, { includeMetadata: true });
    const scenes = scenesResult.scenes;

    // Score all scenes
    const scoredScenes = scenes.map(scene => ({
      ...scene,
      quality: scoreSceneQuality(scene, {
        optimalDuration: optimalDuration ? parseFloat(optimalDuration) : null
      })
    }));

    // Filter by minimum score if provided
    let filteredScenes = scoredScenes;
    if (minScore) {
      filteredScenes = filteredScenes.filter(
        scene => scene.quality.overall >= parseFloat(minScore)
      );
    }

    // Sort by quality
    filteredScenes.sort((a, b) => b.quality.overall - a.quality.overall);

    sendSuccess(res, 'Scene quality scores retrieved', 200, {
      scenes: filteredScenes,
      total: scenes.length,
      filtered: filteredScenes.length,
      averageQuality: scenes.length > 0
        ? scenes.reduce((sum, s) => sum + (s.quality?.overall || 0), 0) / scenes.length
        : 0
    });
  } catch (error) {
    logger.error('Error getting scene quality', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to get scene quality', 500);
  }
}));

/**
 * @route GET /api/video/scenes/:contentId/ranked
 * @desc Get scenes ranked by quality
 * @access Private
 */
router.get('/:contentId/ranked', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { limit, optimalDuration } = req.query;

  try {
    const scenesResult = await getScenesForAsset(contentId, { includeMetadata: true });
    const scenes = scenesResult.scenes;

    // Rank scenes by quality
    const ranked = rankScenesByQuality(scenes, {
      optimalDuration: optimalDuration ? parseFloat(optimalDuration) : null
    });

    // Apply limit if provided
    const limited = limit ? ranked.slice(0, parseInt(limit)) : ranked;

    sendSuccess(res, 'Scenes ranked by quality', 200, {
      scenes: limited,
      total: ranked.length
    });
  } catch (error) {
    logger.error('Error ranking scenes', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to rank scenes', 500);
  }
}));

module.exports = router;








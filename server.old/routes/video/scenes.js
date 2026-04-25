// Scene Detection API Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { detectScenes, getScenesForAsset } = require('../../services/sceneDetectionService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/detect
 * @desc Detect scenes in a video (stateless service)
 * @access Private
 */
router.post('/detect', auth, asyncHandler(async (req, res) => {
  const { 
    videoUrl, 
    videoId, 
    sensitivity, 
    minSceneLength, 
    maxScenes, 
    fps, 
    extractMetadata, 
    useCache,
    useMultiModal,
    workflowType,
    mergeShortScenes,
    shortSceneThreshold
  } = req.body;

  if (!videoUrl && !videoId) {
    return sendError(res, 'Either videoUrl or videoId is required', 400);
  }

  try {
    const videoUrlOrId = videoId || videoUrl;
    const options = {
      sensitivity: sensitivity || 0.3,
      minSceneLength: minSceneLength || 1.0,
      maxScenes: maxScenes || null,
      fps: fps || 3,
      extractMetadata: extractMetadata !== false, // Default to true
      useCache: useCache !== false, // Default to true
      useMultiModal: useMultiModal !== false, // Default to true for better accuracy
      workflowType: workflowType || 'general', // 'tiktok', 'youtube', 'instagram', 'general'
      mergeShortScenes: mergeShortScenes !== false, // Default to true
      shortSceneThreshold: shortSceneThreshold || 2.0,
      userId: req.user._id.toString(),
      // Progress callback can be used for real-time updates via WebSocket if needed
      onProgress: (progress, message) => {
        logger.debug('Scene detection progress', { progress, message, videoUrlOrId });
        // In the future, could emit via WebSocket here
      }
    };

    logger.info('Scene detection requested', { videoUrlOrId, options });

    const result = await detectScenes(videoUrlOrId, options);
    
    sendSuccess(res, 'Scenes detected successfully', 200, result);
  } catch (error) {
    logger.error('Scene detection error', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to detect scenes', 500);
  }
}));

/**
 * @route GET /api/video/scenes/:contentId
 * @desc Get scenes for a specific content asset
 * @access Private
 */
router.get('/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { includeMetadata, sortBy, order } = req.query;

  try {
    const options = {
      includeMetadata: includeMetadata !== 'false',
      sortBy: sortBy || 'sceneIndex',
      order: order || 'asc'
    };

    const result = await getScenesForAsset(contentId, options);
    
    sendSuccess(res, 'Scenes retrieved successfully', 200, result);
  } catch (error) {
    logger.error('Get scenes error', { error: error.message, contentId, userId: req.user._id });
    sendError(res, error.message || 'Failed to get scenes', 500);
  }
}));

/**
 * @route GET /api/video/scenes/:contentId/metadata
 * @desc Get scene metadata summary for a content asset
 * @access Private
 */
router.get('/:contentId/metadata', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const result = await getScenesForAsset(contentId, { includeMetadata: true });
    
    // Summarize metadata
    const summary = {
      totalScenes: result.totalScenes,
      sceneTypes: {},
      tags: {},
      hasSpeechScenes: 0,
      hasFacesScenes: 0,
      averageSceneDuration: 0
    };

    let totalDuration = 0;
    result.scenes.forEach(scene => {
      totalDuration += scene.duration || 0;
      
      if (scene.metadata) {
        if (scene.metadata.label) {
          summary.sceneTypes[scene.metadata.label] = (summary.sceneTypes[scene.metadata.label] || 0) + 1;
        }
        
        if (scene.metadata.tags && scene.metadata.tags.length > 0) {
          scene.metadata.tags.forEach(tag => {
            summary.tags[tag] = (summary.tags[tag] || 0) + 1;
          });
        }
        
        if (scene.metadata.hasSpeech) {
          summary.hasSpeechScenes++;
        }
        
        if (scene.metadata.hasFaces) {
          summary.hasFacesScenes++;
        }
      }
    });

    summary.averageSceneDuration = result.totalScenes > 0 ? totalDuration / result.totalScenes : 0;

    sendSuccess(res, 'Scene metadata retrieved successfully', 200, {
      summary,
      scenes: result.scenes
    });
  } catch (error) {
    logger.error('Get scene metadata error', { error: error.message, contentId, userId: req.user._id });
    sendError(res, error.message || 'Failed to get scene metadata', 500);
  }
}));

module.exports = router;


// Scene Workflow Integration Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  triggerSceneWorkflows,
  createClipsFromScenes,
  generateCaptionsForScenes,
  createCarouselFromScenes,
  tagKeyMoments
} = require('../../services/sceneWorkflowService');
const { getScenesForAsset } = require('../../services/sceneDetectionService');
const Scene = require('../../models/Scene');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/:contentId/promote
 * @desc Promote/demote a scene (mark as highlight)
 * @access Private
 */
router.post('/:contentId/promote/:sceneId', auth, asyncHandler(async (req, res) => {
  const { contentId, sceneId } = req.params;
  const { isPromoted, isHighlight, priority } = req.body;

  try {
    const scene = await Scene.findOne({ _id: sceneId, contentId, userId: req.user._id });
    if (!scene) {
      return sendError(res, 'Scene not found', 404);
    }

    const update = {};
    if (isPromoted !== undefined) update.isPromoted = isPromoted;
    if (isHighlight !== undefined) update.isHighlight = isHighlight;
    if (priority !== undefined) update.priority = priority;

    await Scene.findByIdAndUpdate(sceneId, { $set: update });

    sendSuccess(res, 'Scene updated successfully', 200, {
      sceneId,
      ...update
    });
  } catch (error) {
    logger.error('Error promoting scene', { error: error.message, sceneId, userId: req.user._id });
    sendError(res, error.message || 'Failed to update scene', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:contentId/key-moment
 * @desc Mark scene as key moment
 * @access Private
 */
router.post('/:contentId/key-moment/:sceneId', auth, asyncHandler(async (req, res) => {
  const { contentId, sceneId } = req.params;
  const { isKeyMoment, reason } = req.body;

  try {
    const scene = await Scene.findOne({ _id: sceneId, contentId, userId: req.user._id });
    if (!scene) {
      return sendError(res, 'Scene not found', 404);
    }

    await Scene.findByIdAndUpdate(sceneId, {
      $set: {
        isKeyMoment: isKeyMoment !== false,
        keyMomentReason: reason || 'user_marked'
      }
    });

    sendSuccess(res, 'Key moment updated successfully', 200, {
      sceneId,
      isKeyMoment: isKeyMoment !== false,
      reason: reason || 'user_marked'
    });
  } catch (error) {
    logger.error('Error marking key moment', { error: error.message, sceneId });
    sendError(res, error.message || 'Failed to update key moment', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:contentId/clips
 * @desc Create clips from scenes (scene-aware action)
 * @access Private
 */
router.post('/:contentId/clips', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { maxDuration, minDuration, platforms, generateCaptions } = req.body;

  try {
    const scenesResult = await getScenesForAsset(contentId);
    const scenes = scenesResult.scenes;

    const result = await createClipsFromScenes({
      contentId,
      userId: req.user._id.toString(),
      scenes
    }, {
      maxDuration,
      minDuration,
      platforms,
      generateCaptions
    });

    sendSuccess(res, 'Clips created successfully', 200, result);
  } catch (error) {
    logger.error('Error creating clips from scenes', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to create clips', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:contentId/captions
 * @desc Generate captions for all scenes
 * @access Private
 */
router.post('/:contentId/captions', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const Content = require('../../models/Content');
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== req.user._id.toString()) {
      return sendError(res, 'Content not found', 404);
    }

    const scenesResult = await getScenesForAsset(contentId);
    const scenes = scenesResult.scenes;

    const result = await generateCaptionsForScenes({
      contentId,
      scenes,
      content
    });

    sendSuccess(res, 'Captions generated successfully', 200, result);
  } catch (error) {
    logger.error('Error generating captions', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to generate captions', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:contentId/carousel
 * @desc Create carousel/thread from scenes
 * @access Private
 */
router.post('/:contentId/carousel', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { format, maxScenes, includeCaptions } = req.body;

  try {
    const Content = require('../../models/Content');
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== req.user._id.toString()) {
      return sendError(res, 'Content not found', 404);
    }

    const scenesResult = await getScenesForAsset(contentId);
    const scenes = scenesResult.scenes;

    const result = await createCarouselFromScenes({
      contentId,
      scenes,
      content
    }, {
      format,
      maxScenes,
      includeCaptions
    });

    sendSuccess(res, 'Carousel created successfully', 200, result);
  } catch (error) {
    logger.error('Error creating carousel', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to create carousel', 500);
  }
}));

/**
 * @route POST /api/video/scenes/:contentId/tag-key-moments
 * @desc Auto-tag key moments in scenes
 * @access Private
 */
router.post('/:contentId/tag-key-moments', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { motionThreshold, detectSlideChanges } = req.body;

  try {
    const Content = require('../../models/Content');
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== req.user._id.toString()) {
      return sendError(res, 'Content not found', 404);
    }

    const scenesResult = await getScenesForAsset(contentId);
    const scenes = scenesResult.scenes;

    const result = await tagKeyMoments({
      contentId,
      scenes
    }, {
      motionThreshold,
      detectSlideChanges
    });

    sendSuccess(res, 'Key moments tagged successfully', 200, result);
  } catch (error) {
    logger.error('Error tagging key moments', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to tag key moments', 500);
  }
}));

/**
 * @route GET /api/video/scenes/:contentId/timeline
 * @desc Get scene timeline data for UI visualization
 * @access Private
 */
router.get('/:contentId/timeline', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const scenesResult = await getScenesForAsset(contentId, { includeMetadata: true });
    const scenes = scenesResult.scenes;

    // Format for timeline visualization
    const timeline = scenes.map(scene => ({
      id: scene._id || scene.sceneIndex,
      start: scene.start,
      end: scene.end,
      duration: scene.duration,
      label: scene.metadata?.label || 'Scene',
      color: getSceneColor(scene),
      isHighlight: scene.isHighlight || scene.isPromoted,
      isKeyMoment: scene.isKeyMoment,
      thumbnail: scene.metadata?.thumbnailUrl,
      tags: scene.metadata?.tags || []
    }));

    sendSuccess(res, 'Timeline retrieved successfully', 200, {
      timeline,
      totalDuration: scenes.length > 0 ? scenes[scenes.length - 1].end : 0
    });
  } catch (error) {
    logger.error('Error getting timeline', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to get timeline', 500);
  }
}));

/**
 * Get color for scene visualization
 */
function getSceneColor(scene) {
  if (scene.isHighlight || scene.isPromoted) return '#FFD700'; // Gold for highlights
  if (scene.isKeyMoment) return '#FF6B6B'; // Red for key moments
  if (scene.metadata?.label === 'talking head') return '#4ECDC4'; // Teal
  if (scene.metadata?.label === 'screen share') return '#95E1D3'; // Light teal
  if (scene.metadata?.label === 'B-roll') return '#F38181'; // Pink
  return '#95A5A6'; // Gray default
}

module.exports = router;








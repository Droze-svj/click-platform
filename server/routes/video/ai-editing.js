// AI Video Editing Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  analyzeVideoForEditing,
  autoEditVideo,
  detectScenes,
  detectSmartCuts,
} = require('../../services/aiVideoEditingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/video/ai-editing/analyze:
 *   post:
 *     summary: Analyze video for editing
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze', auth, asyncHandler(async (req, res) => {
  const { videoMetadata } = req.body;

  if (!videoMetadata) {
    return sendError(res, 'Video metadata is required', 400);
  }

  try {
    const analysis = await analyzeVideoForEditing(videoMetadata);
    sendSuccess(res, 'Video analyzed for editing', 200, analysis);
  } catch (error) {
    logger.error('Analyze video for editing error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/auto-edit:
 *   post:
 *     summary: Auto-edit video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/auto-edit', auth, asyncHandler(async (req, res) => {
  const { videoId, editingOptions } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const plan = await autoEditVideo(videoId, editingOptions || {});
    sendSuccess(res, 'Auto-edit plan created', 200, plan);
  } catch (error) {
    logger.error('Auto-edit video error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/scenes:
 *   post:
 *     summary: Detect scenes
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/scenes', auth, asyncHandler(async (req, res) => {
  const { videoId, videoMetadata } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await detectScenes(videoId, videoMetadata || {});
    sendSuccess(res, 'Scenes detected', 200, result);
  } catch (error) {
    logger.error('Detect scenes error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/smart-cuts:
 *   post:
 *     summary: Detect smart cuts
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/smart-cuts', auth, asyncHandler(async (req, res) => {
  const { videoId, videoMetadata } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await detectSmartCuts(videoId, videoMetadata || {});
    sendSuccess(res, 'Smart cuts detected', 200, result);
  } catch (error) {
    logger.error('Detect smart cuts error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







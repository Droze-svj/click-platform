// Video Effects Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  applyFilter,
  addTransition,
  addOverlay,
  applyColorCorrection,
  addMotionEffect,
  getAvailableEffects,
} = require('../../services/videoEffectsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/video/effects/available:
 *   get:
 *     summary: Get available effects
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/available', auth, asyncHandler(async (req, res) => {
  try {
    const effects = getAvailableEffects();
    sendSuccess(res, 'Available effects fetched', 200, effects);
  } catch (error) {
    logger.error('Get available effects error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/effects/filter:
 *   post:
 *     summary: Apply video filter
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/filter', auth, asyncHandler(async (req, res) => {
  const { videoId, filterType, options } = req.body;

  if (!videoId || !filterType) {
    return sendError(res, 'Video ID and filter type are required', 400);
  }

  try {
    const result = await applyFilter(videoId, filterType, options || {});
    sendSuccess(res, 'Filter applied', 200, result);
  } catch (error) {
    logger.error('Apply filter error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/effects/transition:
 *   post:
 *     summary: Add transition
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/transition', auth, asyncHandler(async (req, res) => {
  const { videoId, transitionType, options } = req.body;

  if (!videoId || !transitionType) {
    return sendError(res, 'Video ID and transition type are required', 400);
  }

  try {
    const result = await addTransition(videoId, transitionType, options || {});
    sendSuccess(res, 'Transition added', 200, result);
  } catch (error) {
    logger.error('Add transition error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/effects/overlay:
 *   post:
 *     summary: Add overlay
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/overlay', auth, asyncHandler(async (req, res) => {
  const { videoId, overlayType, options } = req.body;

  if (!videoId || !overlayType) {
    return sendError(res, 'Video ID and overlay type are required', 400);
  }

  try {
    const result = await addOverlay(videoId, overlayType, options || {});
    sendSuccess(res, 'Overlay added', 200, result);
  } catch (error) {
    logger.error('Add overlay error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/effects/color-correction:
 *   post:
 *     summary: Apply color correction
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/color-correction', auth, asyncHandler(async (req, res) => {
  const { videoId, correctionOptions } = req.body;

  if (!videoId || !correctionOptions) {
    return sendError(res, 'Video ID and correction options are required', 400);
  }

  try {
    const result = await applyColorCorrection(videoId, correctionOptions);
    sendSuccess(res, 'Color correction applied', 200, result);
  } catch (error) {
    logger.error('Apply color correction error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/effects/motion:
 *   post:
 *     summary: Add motion effect
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/motion', auth, asyncHandler(async (req, res) => {
  const { videoId, effectType, options } = req.body;

  if (!videoId || !effectType) {
    return sendError(res, 'Video ID and effect type are required', 400);
  }

  try {
    const result = await addMotionEffect(videoId, effectType, options || {});
    sendSuccess(res, 'Motion effect added', 200, result);
  } catch (error) {
    logger.error('Add motion effect error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

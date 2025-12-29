// Smart Thumbnails Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  generateThumbnailSuggestions,
  createThumbnailABTest,
  getThumbnailPerformance,
  generateThumbnailFromFrame,
} = require('../../services/smartThumbnailService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/video/thumbnails/suggestions:
 *   post:
 *     summary: Generate thumbnail suggestions
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/suggestions', auth, asyncHandler(async (req, res) => {
  const { videoId, videoMetadata } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const suggestions = await generateThumbnailSuggestions(videoId, videoMetadata || {});
    sendSuccess(res, 'Thumbnail suggestions generated', 200, suggestions);
  } catch (error) {
    logger.error('Generate thumbnail suggestions error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/thumbnails/ab-test:
 *   post:
 *     summary: Create thumbnail A/B test
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/ab-test', auth, asyncHandler(async (req, res) => {
  const { videoId, thumbnails } = req.body;

  if (!videoId || !thumbnails || !Array.isArray(thumbnails) || thumbnails.length < 2) {
    return sendError(res, 'Video ID and at least 2 thumbnails are required', 400);
  }

  try {
    const test = await createThumbnailABTest(videoId, req.user._id, thumbnails);
    sendSuccess(res, 'Thumbnail A/B test created', 200, test);
  } catch (error) {
    logger.error('Create thumbnail A/B test error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/thumbnails/performance:
 *   get:
 *     summary: Get thumbnail performance
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/performance/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const performance = await getThumbnailPerformance(videoId, req.user._id);
    sendSuccess(res, 'Thumbnail performance fetched', 200, performance);
  } catch (error) {
    logger.error('Get thumbnail performance error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/thumbnails/generate:
 *   post:
 *     summary: Generate thumbnail from frame
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate', auth, asyncHandler(async (req, res) => {
  const { videoId, timestamp, options } = req.body;

  if (!videoId || timestamp === undefined) {
    return sendError(res, 'Video ID and timestamp are required', 400);
  }

  try {
    const thumbnail = await generateThumbnailFromFrame(videoId, timestamp, options || {});
    sendSuccess(res, 'Thumbnail generated', 200, thumbnail);
  } catch (error) {
    logger.error('Generate thumbnail from frame error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







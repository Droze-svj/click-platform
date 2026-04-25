// Video Analytics Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getEngagementHeatmap,
  getWatchTimeAnalytics,
  getAudienceInsights,
  compareVideoPerformance,
} = require('../../services/videoAnalyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/video/analytics/heatmap:
 *   get:
 *     summary: Get engagement heatmap
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/heatmap/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const heatmap = await getEngagementHeatmap(videoId, req.user._id);
    sendSuccess(res, 'Engagement heatmap fetched', 200, heatmap);
  } catch (error) {
    logger.error('Get engagement heatmap error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/analytics/watch-time:
 *   get:
 *     summary: Get watch time analytics
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/watch-time/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const analytics = await getWatchTimeAnalytics(videoId, req.user._id);
    sendSuccess(res, 'Watch time analytics fetched', 200, analytics);
  } catch (error) {
    logger.error('Get watch time analytics error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/analytics/audience:
 *   get:
 *     summary: Get audience insights
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/audience/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const insights = await getAudienceInsights(videoId, req.user._id);
    sendSuccess(res, 'Audience insights fetched', 200, insights);
  } catch (error) {
    logger.error('Get audience insights error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/analytics/compare:
 *   post:
 *     summary: Compare video performance
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/compare', auth, asyncHandler(async (req, res) => {
  const { videoIds } = req.body;

  if (!videoIds || !Array.isArray(videoIds) || videoIds.length < 2) {
    return sendError(res, 'At least 2 video IDs are required', 400);
  }

  try {
    const comparison = await compareVideoPerformance(videoIds, req.user._id);
    sendSuccess(res, 'Video performance compared', 200, comparison);
  } catch (error) {
    logger.error('Compare video performance error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







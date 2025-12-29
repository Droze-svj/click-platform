// Platform analytics routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  syncPostAnalytics,
  syncAllUserAnalytics,
  getAudienceInsights,
} = require('../../services/platformAnalyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/analytics/platform/sync/:postId:
 *   post:
 *     summary: Sync analytics for a specific post
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.post('/sync/:postId', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  try {
    const analytics = await syncPostAnalytics(userId, postId);
    sendSuccess(res, 'Analytics synced successfully', 200, analytics);
  } catch (error) {
    logger.error('Sync analytics error', { error: error.message, postId, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/analytics/platform/sync-all:
 *   post:
 *     summary: Sync analytics for all user posts
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.post('/sync-all', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit } = req.body;

  try {
    const results = await syncAllUserAnalytics(userId, limit || 50);
    sendSuccess(res, 'Analytics sync completed', 200, results);
  } catch (error) {
    logger.error('Sync all analytics error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/analytics/platform/audience:
 *   get:
 *     summary: Get audience insights
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/audience', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const period = parseInt(req.query.period) || 30;

  try {
    const insights = await getAudienceInsights(userId, period);
    sendSuccess(res, 'Audience insights fetched', 200, insights);
  } catch (error) {
    logger.error('Get audience insights error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







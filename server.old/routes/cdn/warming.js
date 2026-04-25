// Cache Warming Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  warmCache,
  warmPopularContent,
  warmUserDashboard,
  scheduleCacheWarming,
} = require('../../services/cacheWarmingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/cdn/warming/warm:
 *   post:
 *     summary: Warm cache for paths
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.post('/warm', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { paths, priority = 'normal', concurrency = 5 } = req.body;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return sendError(res, 'Paths array is required', 400);
  }

  try {
    const result = await warmCache(paths, { priority, concurrency });
    sendSuccess(res, 'Cache warmed', 200, result);
  } catch (error) {
    logger.error('Warm cache error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/warming/popular:
 *   post:
 *     summary: Warm cache for popular content
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.post('/popular', auth, requireAdmin, asyncHandler(async (req, res) => {
  const limit = parseInt(req.body.limit) || 100;

  try {
    const result = await warmPopularContent(limit);
    sendSuccess(res, 'Popular content cache warmed', 200, result);
  } catch (error) {
    logger.error('Warm popular content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/warming/user/:userId:
 *   post:
 *     summary: Warm cache for user dashboard
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.post('/user/:userId', auth, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Users can only warm their own dashboard
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return sendError(res, 'Unauthorized', 403);
  }

  try {
    const result = await warmUserDashboard(userId);
    sendSuccess(res, 'User dashboard cache warmed', 200, result);
  } catch (error) {
    logger.error('Warm user dashboard error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/warming/schedule:
 *   post:
 *     summary: Schedule cache warming
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.post('/schedule', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { schedule = '0 3 * * *' } = req.body;

  try {
    await scheduleCacheWarming(schedule);
    sendSuccess(res, 'Cache warming scheduled', 200);
  } catch (error) {
    logger.error('Schedule cache warming error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







// Cache management routes

const express = require('express');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  get,
  set,
  del,
  invalidateUserCache,
  isEnabled,
} = require('../services/cacheService');
// Optional: Try to load cache warming service, fallback if not available
let warmUserCache = null;
let warmAnalyticsCache = null;
let warmAllCaches = null;
try {
  const cacheWarming = require('../services/cacheWarmingService');
  warmUserCache = cacheWarming.warmUserCache;
  warmAnalyticsCache = cacheWarming.warmAnalyticsCache;
  warmAllCaches = cacheWarming.warmAllCaches;
} catch (error) {
  logger.warn('Cache warming service not available', { error: error.message });
  warmUserCache = async () => {};
  warmAnalyticsCache = async () => {};
  warmAllCaches = async () => {};
}
const router = express.Router();

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  try {
    // In production, get actual Redis stats
    sendSuccess(res, 'Cache stats fetched', 200, {
      enabled: isEnabled(),
      // Add more stats if available
    });
  } catch (error) {
    logger.error('Get cache stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cache/warm:
 *   post:
 *     summary: Warm cache for user
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 */
router.post('/warm', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { type = 'user' } = req.body;

  try {
    if (type === 'user') {
      await warmUserCache(userId);
    } else if (type === 'analytics') {
      const period = req.body.period || 30;
      await warmAnalyticsCache(userId, period);
    } else if (type === 'all') {
      await warmAllCaches();
    }

    sendSuccess(res, 'Cache warmed', 200);
  } catch (error) {
    logger.error('Warm cache error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cache/invalidate:
 *   post:
 *     summary: Invalidate user cache
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 */
router.post('/invalidate', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    await invalidateUserCache(userId);
    sendSuccess(res, 'Cache invalidated', 200);
  } catch (error) {
    logger.error('Invalidate cache error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







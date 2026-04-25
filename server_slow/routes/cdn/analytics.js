// CDN Analytics Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getCacheStats,
  getPathStats,
  getRegionStats,
  getAnalyticsSummary,
  resetAnalytics,
} = require('../../services/cdnAnalyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/cdn/analytics:
 *   get:
 *     summary: Get CDN analytics summary
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const summary = getAnalyticsSummary();
    sendSuccess(res, 'CDN analytics fetched', 200, summary);
  } catch (error) {
    logger.error('Get CDN analytics error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/analytics/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const stats = getCacheStats();
    sendSuccess(res, 'Cache stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get cache stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/analytics/paths:
 *   get:
 *     summary: Get path statistics
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.get('/paths', auth, requireAdmin, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  try {
    const paths = getPathStats(limit);
    sendSuccess(res, 'Path stats fetched', 200, paths);
  } catch (error) {
    logger.error('Get path stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/analytics/regions:
 *   get:
 *     summary: Get region statistics
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.get('/regions', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const regions = getRegionStats();
    sendSuccess(res, 'Region stats fetched', 200, regions);
  } catch (error) {
    logger.error('Get region stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/cdn/analytics/reset:
 *   post:
 *     summary: Reset analytics (admin)
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 */
router.post('/reset', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    resetAnalytics();
    sendSuccess(res, 'Analytics reset', 200);
  } catch (error) {
    logger.error('Reset analytics error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







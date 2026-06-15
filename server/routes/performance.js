// Performance monitoring routes

const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const { getSlowQueries, getQueryStats, clearSlowQueries } = require('../services/queryPerformanceMonitor');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

// The slow-query monitor exposes the actual filter objects of slow queries across
// ALL users/collections (userIds, emails, search terms) and lets the log be wiped.
// Admin-only — the equivalent data under /api/monitoring is already admin-gated.
// (Per-route `auth` below is redundant but harmless.)
router.use(auth, requireAdmin);

/**
 * @swagger
 * /api/performance/queries/slow:
 *   get:
 *     summary: Get slow queries
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/queries/slow', auth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;

  try {
    const queries = getSlowQueries(limit);
    sendSuccess(res, 'Slow queries fetched', 200, queries);
  } catch (error) {
    logger.error('Get slow queries error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/performance/queries/stats:
 *   get:
 *     summary: Get query statistics
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/queries/stats', auth, asyncHandler(async (req, res) => {
  try {
    const stats = getQueryStats();
    sendSuccess(res, 'Query stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get query stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/performance/queries/clear:
 *   post:
 *     summary: Clear slow queries log
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 */
router.post('/queries/clear', auth, asyncHandler(async (req, res) => {
  try {
    clearSlowQueries();
    sendSuccess(res, 'Slow queries cleared', 200);
  } catch (error) {
    logger.error('Clear slow queries error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







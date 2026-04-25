// Database Sharding Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  checkDatabaseHealth,
  getShardingStats,
} = require('../../services/databaseShardingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.use(auth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/database/health:
 *   get:
 *     summary: Check database health
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const health = await checkDatabaseHealth();
    sendSuccess(res, 'Database health checked', 200, health);
  } catch (error) {
    logger.error('Check database health error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/database/sharding:
 *   get:
 *     summary: Get sharding statistics
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 */
router.get('/sharding', asyncHandler(async (req, res) => {
  try {
    const stats = getShardingStats();
    sendSuccess(res, 'Sharding stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get sharding stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







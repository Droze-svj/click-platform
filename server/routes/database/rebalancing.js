// Database Rebalancing Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  analyzeShardDistribution,
  getShardHealth,
  recommendRebalancing,
} = require('../../services/shardRebalancingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.use(auth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/database/rebalancing/analyze:
 *   get:
 *     summary: Analyze shard distribution
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analyze', asyncHandler(async (req, res) => {
  try {
    const analysis = await analyzeShardDistribution();
    sendSuccess(res, 'Shard distribution analyzed', 200, analysis);
  } catch (error) {
    logger.error('Analyze shard distribution error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/database/rebalancing/health:
 *   get:
 *     summary: Get shard health
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const health = await getShardHealth();
    sendSuccess(res, 'Shard health checked', 200, health);
  } catch (error) {
    logger.error('Get shard health error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/database/rebalancing/recommend:
 *   get:
 *     summary: Get rebalancing recommendation
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 */
router.get('/recommend', asyncHandler(async (req, res) => {
  try {
    const recommendation = await recommendRebalancing();
    sendSuccess(res, 'Rebalancing recommendation fetched', 200, recommendation);
  } catch (error) {
    logger.error('Get rebalancing recommendation error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







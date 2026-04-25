// Job Metrics Routes
// Provides job metrics and analytics

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getQueueMetrics,
  getUserJobMetrics,
} = require('../../services/jobMetricsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/jobs/metrics/queue/:queueName
 * Get metrics for a specific queue
 */
router.get('/queue/:queueName', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { queueName } = req.params;
  const { timeRange = '24h' } = req.query;

  try {
    const metrics = await getQueueMetrics(queueName, timeRange);
    sendSuccess(res, 'Queue metrics retrieved', 200, metrics);
  } catch (error) {
    logger.error('Get queue metrics error', { error: error.message, queueName });
    sendError(res, error.message, 500);
  }
}));

/**
 * GET /api/jobs/metrics/user
 * Get user's job metrics
 */
router.get('/user', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { timeRange = '24h' } = req.query;

  try {
    const metrics = await getUserJobMetrics(userId, timeRange);
    sendSuccess(res, 'User job metrics retrieved', 200, metrics);
  } catch (error) {
    logger.error('Get user metrics error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;




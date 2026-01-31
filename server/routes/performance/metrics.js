// Performance Metrics Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleAuth');
const { sendSuccess, sendError } = require('../../utils/response');
const performanceMonitoringService = require('../../services/performanceMonitoringService');
const logger = require('../../utils/logger');

/**
 * GET /api/performance/metrics
 * Get performance metrics (admin only)
 */
router.get('/', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const metrics = performanceMonitoringService.getMetrics();
    return sendSuccess(res, metrics);
  } catch (error) {
    logger.error('Error getting performance metrics', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/performance/metrics/reset
 * Reset performance metrics (admin only)
 */
router.post('/reset', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    performanceMonitoringService.resetMetrics();
    return sendSuccess(res, null, 'Metrics reset successfully');
  } catch (error) {
    logger.error('Error resetting metrics', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;

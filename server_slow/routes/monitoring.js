// Monitoring Routes

const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const {
  getMetrics,
  checkAlerts,
  exportPrometheusMetrics,
} = require('../services/monitoringService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/monitoring/metrics:
 *   get:
 *     summary: Get metrics (admin)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 */
router.get('/metrics', auth, requireAdmin, asyncHandler(async (req, res) => {
  const {
    includeSystem = true,
    includeDatabase = true,
    includeRequests = true,
  } = req.query;

  try {
    const metrics = getMetrics({
      includeSystem: includeSystem === 'true',
      includeDatabase: includeDatabase === 'true',
      includeRequests: includeRequests === 'true',
    });
    sendSuccess(res, 'Metrics fetched', 200, metrics);
  } catch (error) {
    logger.error('Get metrics error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/monitoring/alerts:
 *   get:
 *     summary: Check alerts (admin)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 */
router.get('/alerts', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const alerts = await checkAlerts();
    sendSuccess(res, 'Alerts checked', 200, alerts);
  } catch (error) {
    logger.error('Check alerts error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/monitoring/prometheus:
 *   get:
 *     summary: Export Prometheus metrics
 *     tags: [Monitoring]
 */
router.get('/prometheus', asyncHandler(async (req, res) => {
  try {
    const metrics = exportPrometheusMetrics();
    res.setHeader('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Export Prometheus metrics error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







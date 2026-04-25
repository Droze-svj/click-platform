// Business Intelligence Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getBusinessMetrics,
  getTrends,
  exportDataForBI,
} = require('../../services/businessIntelligenceService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/analytics/bi/metrics:
 *   get:
 *     summary: Get business intelligence metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/metrics', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const period = parseInt(req.query.period) || 30;

  try {
    const metrics = await getBusinessMetrics(userId, period);
    sendSuccess(res, 'Business metrics fetched', 200, metrics);
  } catch (error) {
    logger.error('Get BI metrics error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/analytics/bi/trends:
 *   get:
 *     summary: Get trends over time
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trends', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const period = parseInt(req.query.period) || 30;
  const granularity = req.query.granularity || 'day';

  try {
    const trends = await getTrends(userId, period, granularity);
    sendSuccess(res, 'Trends fetched', 200, trends);
  } catch (error) {
    logger.error('Get trends error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/analytics/bi/export:
 *   get:
 *     summary: Export data for BI tools
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/export', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const format = req.query.format || 'json';

  try {
    const data = await exportDataForBI(userId, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=bi-export.csv');
      return res.send(data);
    }

    sendSuccess(res, 'Data exported', 200, data);
  } catch (error) {
    logger.error('Export BI data error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







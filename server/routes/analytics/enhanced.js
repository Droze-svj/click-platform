// Enhanced analytics routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getComprehensiveAnalytics,
  getPerformanceTrends,
  exportAnalytics
} = require('../../services/analyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/analytics/enhanced/comprehensive:
 *   get:
 *     summary: Get comprehensive analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/comprehensive', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const analytics = await getComprehensiveAnalytics(req.user._id, parseInt(period));
  sendSuccess(res, 'Comprehensive analytics fetched', 200, analytics);
}));

/**
 * @swagger
 * /api/analytics/enhanced/trends:
 *   get:
 *     summary: Get performance trends
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trends', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const trends = await getPerformanceTrends(req.user._id, parseInt(period));
  sendSuccess(res, 'Performance trends fetched', 200, trends);
}));

/**
 * @swagger
 * /api/analytics/enhanced/export:
 *   get:
 *     summary: Export analytics data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/export', auth, asyncHandler(async (req, res) => {
  const { format = 'json', period = 30 } = req.query;

  const data = await exportAnalytics(req.user._id, format, parseInt(period));

  if (format === 'csv') {
    res.header('Content-Type', 'text/csv');
    res.attachment(`analytics_export_${Date.now()}.csv`);
    return res.send(data);
  }

  res.header('Content-Type', 'application/json');
  res.attachment(`analytics_export_${Date.now()}.json`);
  sendSuccess(res, 'Analytics exported', 200, data);
}));

module.exports = router;








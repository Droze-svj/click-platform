// Error Analytics Routes (Admin Only)

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  getErrorStatistics,
  getErrorTrends,
  getMostCommonErrors,
  checkErrorRateThreshold,
} = require('../../services/errorAnalyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const router = express.Router();

// All routes require admin access
router.use(auth, requireAdmin);

/**
 * GET /api/admin/error-analytics/stats
 * Get error statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    groupBy = 'hour',
  } = req.query;

  const options = {
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    groupBy,
  };

  const statistics = await getErrorStatistics(options);
  sendSuccess(res, 'Error statistics fetched', 200, statistics);
}));

/**
 * GET /api/admin/error-analytics/trends
 * Get error trends
 */
router.get('/trends', asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const trends = await getErrorTrends(parseInt(days));
  sendSuccess(res, 'Error trends fetched', 200, trends);
}));

/**
 * GET /api/admin/error-analytics/common
 * Get most common errors
 */
router.get('/common', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const errors = await getMostCommonErrors(parseInt(limit));
  sendSuccess(res, 'Most common errors fetched', 200, errors);
}));

/**
 * GET /api/admin/error-analytics/rate-check
 * Check if error rate exceeds threshold
 */
router.get('/rate-check', asyncHandler(async (req, res) => {
  const { threshold = 100 } = req.query;
  const result = await checkErrorRateThreshold(parseInt(threshold));
  sendSuccess(res, 'Error rate checked', 200, result);
}));

module.exports = router;






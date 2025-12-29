// Performance Monitoring Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleBasedAccess');
const {
  getMetrics,
  getSlowQueries,
  getRecentErrors,
} = require('../../services/performanceMonitoringService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();

/**
 * GET /api/monitoring/performance
 * Get performance metrics (Admin only)
 */
router.get('/', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const timeWindow = parseInt(req.query.timeWindow) || 3600000; // Default 1 hour
  const metrics = getMetrics(timeWindow);
  sendSuccess(res, 'Performance metrics retrieved', 200, metrics);
}));

/**
 * GET /api/monitoring/performance/slow-queries
 * Get slow queries (Admin only)
 */
router.get('/slow-queries', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const slowQueries = getSlowQueries(limit);
  sendSuccess(res, 'Slow queries retrieved', 200, { queries: slowQueries });
}));

/**
 * GET /api/monitoring/performance/recent-errors
 * Get recent errors (Admin only)
 */
router.get('/recent-errors', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const errors = getRecentErrors(limit);
  sendSuccess(res, 'Recent errors retrieved', 200, { errors });
}));

module.exports = router;





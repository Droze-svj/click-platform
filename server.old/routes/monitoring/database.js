// Database Monitoring Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleBasedAccess');
const {
  getQueryStats,
  getSlowQueries,
  getQueriesByModel,
  getQueriesByOperation,
} = require('../../services/databaseMonitoringService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();

/**
 * GET /api/monitoring/database
 * Get database query statistics (Admin only)
 */
router.get('/', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const stats = getQueryStats();
  sendSuccess(res, 'Database statistics retrieved', 200, stats);
}));

/**
 * GET /api/monitoring/database/slow-queries
 * Get slow queries (Admin only)
 */
router.get('/slow-queries', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const queries = getSlowQueries(limit);
  sendSuccess(res, 'Slow queries retrieved', 200, { queries });
}));

/**
 * GET /api/monitoring/database/by-model
 * Get queries by model (Admin only)
 */
router.get('/by-model', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const stats = getQueriesByModel();
  sendSuccess(res, 'Queries by model retrieved', 200, stats);
}));

/**
 * GET /api/monitoring/database/by-operation
 * Get queries by operation (Admin only)
 */
router.get('/by-operation', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const stats = getQueriesByOperation();
  sendSuccess(res, 'Queries by operation retrieved', 200, stats);
}));

module.exports = router;





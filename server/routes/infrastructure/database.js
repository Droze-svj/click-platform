// Database Optimization Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  optimizeConnectionPool,
  analyzeSlowQueries,
  optimizeIndexes,
  getDatabaseStats,
} = require('../../services/databaseOptimizationService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.post('/optimize-pool', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const options = optimizeConnectionPool();
    sendSuccess(res, 'Connection pool optimized', 200, options);
  } catch (error) {
    logger.error('Optimize connection pool error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/slow-queries', auth, requireAdmin, asyncHandler(async (req, res) => {
  const threshold = parseInt(req.query.threshold) || 1000;
  try {
    const analysis = await analyzeSlowQueries(threshold);
    sendSuccess(res, 'Slow queries analyzed', 200, analysis);
  } catch (error) {
    logger.error('Analyze slow queries error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/indexes', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const analysis = await optimizeIndexes();
    sendSuccess(res, 'Indexes analyzed', 200, analysis);
  } catch (error) {
    logger.error('Optimize indexes error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/stats', auth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    sendSuccess(res, 'Database stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get database stats error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







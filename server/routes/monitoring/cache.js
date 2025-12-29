// Cache Monitoring Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleBasedAccess');
const {
  getCacheStats,
  checkRedisConnection,
  getCacheSize,
} = require('../../services/cacheMonitoringService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();

/**
 * GET /api/monitoring/cache
 * Get cache statistics (Admin only)
 */
router.get('/', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const stats = getCacheStats();
  sendSuccess(res, 'Cache statistics retrieved', 200, stats);
}));

/**
 * GET /api/monitoring/cache/connection
 * Check Redis connection (Admin only)
 */
router.get('/connection', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const connection = await checkRedisConnection();
  sendSuccess(res, 'Redis connection status retrieved', 200, connection);
}));

/**
 * GET /api/monitoring/cache/size
 * Get cache size (Admin only)
 */
router.get('/size', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const size = await getCacheSize();
  sendSuccess(res, 'Cache size retrieved', 200, size);
}));

module.exports = router;





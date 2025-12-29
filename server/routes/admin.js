// Admin routes for monitoring and management

const express = require('express');
const auth = require('../middleware/auth');
const cache = require('../utils/cache');
const jobQueue = require('../utils/jobQueue');
const { checkDatabaseHealth } = require('../middleware/databaseErrorHandler');
const logger = require('../utils/logger');
const router = express.Router();

// Admin middleware - check if user is admin
const isAdmin = (req, res, next) => {
  // In production, check user role
  // For now, allow all authenticated users
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }
  next();
};

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get system statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const cacheStats = cache.getStats();
    const jobStats = jobQueue.getStats();
    const dbHealth = await checkDatabaseHealth();

    // Get memory usage
    const used = process.memoryUsage();
    const memory = {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(used.external / 1024 / 1024)}MB`
    };

    res.json({
      success: true,
      data: {
        cache: cacheStats,
        jobs: jobStats,
        database: dbHealth,
        memory,
        uptime: process.uptime()
      }
    });
  } catch (error) {
    logger.error('Admin stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/cache/clear:
 *   post:
 *     summary: Clear cache
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/cache/clear', auth, isAdmin, (req, res) => {
  try {
    cache.clear();
    logger.info('Cache cleared by admin', { userId: req.user._id });
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/jobs/stats:
 *   get:
 *     summary: Get job queue statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/jobs/stats', auth, isAdmin, (req, res) => {
  try {
    const stats = jobQueue.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;








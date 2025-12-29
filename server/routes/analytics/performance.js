// Performance analytics routes

const express = require('express');
const performanceMonitor = require('../../utils/performanceMonitor');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleBasedAccess');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/analytics/performance:
 *   get:
 *     summary: Get performance metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  sendSuccess(res, 'Performance metrics fetched', 200, metrics);
}));

/**
 * @swagger
 * /api/analytics/performance/summary:
 *   get:
 *     summary: Get performance summary
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/summary', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const summary = performanceMonitor.getSummary();
  sendSuccess(res, 'Performance summary fetched', 200, summary);
}));

/**
 * @swagger
 * /api/analytics/performance/reset:
 *   post:
 *     summary: Reset performance metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.post('/reset', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  performanceMonitor.reset();
  sendSuccess(res, 'Performance metrics reset', 200);
}));

module.exports = router;








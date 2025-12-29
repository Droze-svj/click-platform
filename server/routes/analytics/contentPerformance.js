// Content performance analytics routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getContentPerformance,
  getPerformancePrediction,
  getOptimalPostingTimes
} = require('../../services/contentPerformanceService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/analytics/content-performance/{contentId}:
 *   get:
 *     summary: Get performance analytics for a content item
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const performance = await getContentPerformance(contentId, req.user._id);
  sendSuccess(res, 'Content performance fetched', 200, performance);
}));

/**
 * @swagger
 * /api/analytics/content-performance/{contentId}/prediction:
 *   get:
 *     summary: Get performance prediction for content
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId/prediction', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const prediction = await getPerformancePrediction(contentId, req.user._id);
  sendSuccess(res, 'Performance prediction fetched', 200, prediction);
}));

/**
 * @swagger
 * /api/analytics/optimal-times:
 *   get:
 *     summary: Get optimal posting times
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/optimal-times', auth, asyncHandler(async (req, res) => {
  const { platform } = req.query;
  const optimalTimes = await getOptimalPostingTimes(req.user._id, platform);
  sendSuccess(res, 'Optimal posting times fetched', 200, optimalTimes);
}));

module.exports = router;








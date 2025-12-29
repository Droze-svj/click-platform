// Advanced Analytics Features Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getPerformanceHeatmap,
  getBestTimesToPost,
  getContentGapAnalysis,
  calculateROI
} = require('../../services/advancedAnalyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * GET /api/analytics/heatmap
 * Get performance heatmap
 */
router.get('/heatmap', auth, asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  
  const result = await getPerformanceHeatmap(req.user._id, periodDays);
  
  sendSuccess(res, 'Heatmap data retrieved', 200, result);
}));

/**
 * GET /api/analytics/best-times
 * Get best times to post
 */
router.get('/best-times', auth, asyncHandler(async (req, res) => {
  const { platform = 'all' } = req.query;
  
  const result = await getBestTimesToPost(req.user._id, platform);
  
  sendSuccess(res, 'Best times retrieved', 200, result);
}));

/**
 * GET /api/analytics/gap-analysis
 * Get content gap analysis
 */
router.get('/gap-analysis', auth, asyncHandler(async (req, res) => {
  const result = await getContentGapAnalysis(req.user._id);
  
  sendSuccess(res, 'Gap analysis retrieved', 200, result);
}));

/**
 * GET /api/analytics/roi
 * Calculate ROI
 */
router.get('/roi', auth, asyncHandler(async (req, res) => {
  const { period = '30d', hourlyRate = 50 } = req.query;
  const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const rate = parseFloat(hourlyRate) || 50;
  
  const result = await calculateROI(req.user._id, periodDays, rate);
  
  sendSuccess(res, 'ROI calculated', 200, result);
}));

module.exports = router;



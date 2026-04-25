// Growth Analytics Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getGrowthMetrics,
  getGrowthInsights,
  getContentForecast,
  getEngagementRecommendations
} = require('../../services/growthInsightsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * GET /api/analytics/growth
 * Get growth metrics and insights
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  
  const metrics = await getGrowthMetrics(req.user._id, periodDays);
  const insights = await getGrowthInsights(req.user._id, periodDays);
  
  sendSuccess(res, 'Growth data retrieved', 200, {
    metrics,
    insights
  });
}));

/**
 * GET /api/analytics/growth/forecast
 * Get content performance forecast
 */
router.get('/forecast', auth, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const forecast = await getContentForecast(req.user._id, parseInt(days));
  
  sendSuccess(res, 'Forecast generated', 200, forecast);
}));

/**
 * GET /api/analytics/growth/recommendations
 * Get engagement optimization recommendations
 */
router.get('/recommendations', auth, asyncHandler(async (req, res) => {
  const recommendations = await getEngagementRecommendations(req.user._id);
  
  sendSuccess(res, 'Recommendations retrieved', 200, {
    recommendations
  });
}));

module.exports = router;



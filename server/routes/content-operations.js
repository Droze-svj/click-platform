// AI Content Operations Routes
// Market positioning: "AI content operations" for social, not just "AI writing"

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  performContentHealthCheck,
  getFutureContentSuggestions
} = require('../services/contentHealthService');
const {
  getAdaptivePerformancePrediction,
  updatePredictionsWithNewData
} = require('../services/adaptivePerformanceService');
const {
  getCompetitiveBenchmarks,
  getNextWeekRecommendations,
  trackCompetitors,
  compareWithCompetitors
} = require('../services/competitiveBenchmarkingService');
const {
  monitorContentHealth,
  autoOptimizeContent,
  predictFutureGaps,
  analyzeContentAttribution,
  analyzeHistoricalTrends,
  getContentRefreshRecommendations
} = require('../services/contentHealthService');

const router = express.Router();

/**
 * GET /api/content-operations/health
 * Comprehensive content health check
 */
router.get('/health', auth, asyncHandler(async (req, res) => {
  const { contentId = null } = req.query;

  const healthCheck = await performContentHealthCheck(req.user._id, contentId);
  sendSuccess(res, 'Content health check completed', 200, healthCheck);
}));

/**
 * GET /api/content-operations/health/suggestions
 * Get future content suggestions based on gaps
 */
router.get('/health/suggestions', auth, asyncHandler(async (req, res) => {
  const { count = 10 } = req.query;

  const healthCheck = await performContentHealthCheck(req.user._id);
  const suggestions = await getFutureContentSuggestions(req.user._id, healthCheck.gaps, parseInt(count));

  sendSuccess(res, 'Content suggestions generated', 200, {
    suggestions,
    basedOn: {
      gaps: healthCheck.gaps,
      healthScore: healthCheck.overall.score
    }
  });
}));

/**
 * GET /api/content-operations/performance/:contentId
 * Get adaptive performance prediction
 */
router.get('/performance/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platform } = req.query;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const prediction = await getAdaptivePerformancePrediction(req.user._id, contentId, platform);
  sendSuccess(res, 'Performance prediction retrieved', 200, prediction);
}));

/**
 * POST /api/content-operations/performance/:contentId/update
 * Update predictions with new real data
 */
router.post('/performance/:contentId/update', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const updated = await updatePredictionsWithNewData(req.user._id, contentId);
  sendSuccess(res, 'Predictions updated with real data', 200, updated);
}));

/**
 * GET /api/content-operations/benchmarks
 * Get competitive benchmarks
 */
router.get('/benchmarks', auth, asyncHandler(async (req, res) => {
  const { platform, timeframe = '30days' } = req.query;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const benchmarks = await getCompetitiveBenchmarks(req.user._id, platform, timeframe);
  sendSuccess(res, 'Competitive benchmarks retrieved', 200, benchmarks);
}));

/**
 * GET /api/content-operations/next-week
 * What to post next week to beat benchmark
 */
router.get('/next-week', auth, asyncHandler(async (req, res) => {
  const { platform } = req.query;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const recommendations = await getNextWeekRecommendations(req.user._id, platform);
  sendSuccess(res, 'Next week recommendations generated', 200, recommendations);
}));

/**
 * POST /api/content-operations/health/monitor
 * Real-time health monitoring
 */
router.post('/health/monitor', auth, asyncHandler(async (req, res) => {
  const { checkInterval, alertThreshold, autoOptimize } = req.body;

  const monitoring = await monitorContentHealth(req.user._id, {
    checkInterval,
    alertThreshold,
    autoOptimize
  });

  sendSuccess(res, 'Health monitoring completed', 200, monitoring);
}));

/**
 * POST /api/content-operations/health/auto-optimize
 * Auto-optimize content based on health
 */
router.post('/health/auto-optimize', auth, asyncHandler(async (req, res) => {
  const healthCheck = await performContentHealthCheck(req.user._id);
  const optimized = await autoOptimizeContent(req.user._id, healthCheck);

  sendSuccess(res, 'Content auto-optimized', 200, optimized);
}));

/**
 * GET /api/content-operations/gaps/predict
 * Predict future content gaps
 */
router.get('/gaps/predict', auth, asyncHandler(async (req, res) => {
  const { timeframe = '30days' } = req.query;

  const predictedGaps = await predictFutureGaps(req.user._id, timeframe);
  sendSuccess(res, 'Future gaps predicted', 200, predictedGaps);
}));

/**
 * GET /api/content-operations/attribution
 * Content performance attribution analysis
 */
router.get('/attribution', auth, asyncHandler(async (req, res) => {
  const { timeframe = '30days' } = req.query;

  const attribution = await analyzeContentAttribution(req.user._id, timeframe);
  sendSuccess(res, 'Attribution analysis completed', 200, attribution);
}));

/**
 * GET /api/content-operations/trends
 * Historical trend analysis
 */
router.get('/trends', auth, asyncHandler(async (req, res) => {
  const { timeframe = '90days' } = req.query;

  const trends = await analyzeHistoricalTrends(req.user._id, timeframe);
  sendSuccess(res, 'Trend analysis completed', 200, trends);
}));

/**
 * GET /api/content-operations/refresh/recommendations
 * Automated content refresh recommendations
 */
router.get('/refresh/recommendations', auth, asyncHandler(async (req, res) => {
  const { minAge, minEngagement, maxRefresh } = req.query;

  const recommendations = await getContentRefreshRecommendations(req.user._id, {
    minAge: minAge ? parseInt(minAge) : 30,
    minEngagement: minEngagement ? parseInt(minEngagement) : 100,
    maxRefresh: maxRefresh ? parseInt(maxRefresh) : 20
  });

  sendSuccess(res, 'Refresh recommendations generated', 200, recommendations);
}));

/**
 * POST /api/content-operations/competitors/track
 * Track competitors
 */
router.post('/competitors/track', auth, asyncHandler(async (req, res) => {
  const { usernames, platform } = req.body;

  if (!usernames || !Array.isArray(usernames) || !platform) {
    return sendError(res, 'Usernames array and platform are required', 400);
  }

  const tracking = await trackCompetitors(req.user._id, usernames, platform);
  sendSuccess(res, 'Competitors tracked', 200, tracking);
}));

/**
 * GET /api/content-operations/competitors/compare
 * Compare with competitors
 */
router.get('/competitors/compare', auth, asyncHandler(async (req, res) => {
  const { platform } = req.query;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const comparison = await compareWithCompetitors(req.user._id, platform);
  sendSuccess(res, 'Competitor comparison completed', 200, comparison);
}));

module.exports = router;


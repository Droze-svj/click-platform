// Content Recycling Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  identifyRecyclableContent,
  detectEvergreenContent,
  createRecyclingPlan,
  scheduleNextRepost,
  updateRepostPerformance,
  getRecyclingStats,
  suggestRecyclableContent,
  toggleRecycling,
  detectContentDecay,
  autoAdjustRecycling,
  bulkCreateRecyclingPlans,
  getAdvancedAnalytics,
  optimizeRepostTiming,
  applyAdvancedRefreshStrategy,
  optimizeMultiPlatformRepost,
  getRepostAnalytics,
  generateSmartVariations,
  predictRepostPerformance,
  analyzeRepostROI,
  detectAudienceOverlap,
  forecastRepostEngagement,
  detectSchedulingConflicts,
  createRepostABTest
} = require('../services/contentRecyclingService');
const {
  createRepostAlert,
  checkRepostAlerts,
  getUserAlerts,
  toggleAlert,
  deleteAlert
} = require('../services/repostAlertService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * GET /api/recycling/suggestions
 * Get suggested recyclable content
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const suggestions = await suggestRecyclableContent(req.user._id, parseInt(limit));
  sendSuccess(res, 'Suggestions retrieved', 200, { suggestions });
}));

/**
 * GET /api/recycling/recyclable
 * Identify recyclable content
 */
router.get('/recyclable', auth, asyncHandler(async (req, res) => {
  const {
    minEngagement = 100,
    minEngagementRate = 2.0,
    daysSincePost = 7,
    platforms,
    limit = 20
  } = req.query;

  const platformArray = platforms ? platforms.split(',') : null;

  const recyclable = await identifyRecyclableContent(req.user._id, {
    minEngagement: parseInt(minEngagement),
    minEngagementRate: parseFloat(minEngagementRate),
    daysSincePost: parseInt(daysSincePost),
    platforms: platformArray,
    limit: parseInt(limit)
  });

  sendSuccess(res, 'Recyclable content identified', 200, { recyclable });
}));

/**
 * POST /api/recycling/create
 * Create recycling plan
 */
router.post('/create', auth, asyncHandler(async (req, res) => {
  const { postId, ...options } = req.body;

  if (!postId) {
    return sendError(res, 'Post ID is required', 400);
  }

  const recycle = await createRecyclingPlan(req.user._id, postId, options);
  sendSuccess(res, 'Recycling plan created', 201, recycle);
}));

/**
 * GET /api/recycling/stats
 * Get recycling statistics
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  const stats = await getRecyclingStats(req.user._id);
  sendSuccess(res, 'Stats retrieved', 200, stats);
}));

/**
 * GET /api/recycling/plans
 * Get all recycling plans
 */
router.get('/plans', auth, asyncHandler(async (req, res) => {
  const ContentRecycle = require('../models/ContentRecycle');
  const { status } = req.query;

  const query = { userId: req.user._id };
  if (status) {
    query.status = status;
  }

  const plans = await ContentRecycle.find(query)
    .populate('originalContentId', 'title type')
    .populate('originalPostId')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'Plans retrieved', 200, { plans });
}));

/**
 * GET /api/recycling/plans/:recycleId
 * Get recycling plan details
 */
router.get('/plans/:recycleId', auth, asyncHandler(async (req, res) => {
  const ContentRecycle = require('../models/ContentRecycle');
  const { recycleId } = req.params;

  const plan = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  })
    .populate('originalContentId')
    .populate('originalPostId')
    .populate('reposts.postId')
    .lean();

  if (!plan) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  sendSuccess(res, 'Plan retrieved', 200, plan);
}));

/**
 * POST /api/recycling/plans/:recycleId/schedule
 * Manually schedule next repost
 */
router.post('/plans/:recycleId/schedule', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;

  const post = await scheduleNextRepost(recycleId);
  if (!post) {
    return sendError(res, 'No more reposts available or plan completed', 400);
  }

  sendSuccess(res, 'Repost scheduled', 200, { post });
}));

/**
 * POST /api/recycling/plans/:recycleId/toggle
 * Pause/Resume recycling
 */
router.post('/plans/:recycleId/toggle', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { isActive } = req.body;

  const plan = await toggleRecycling(recycleId, req.user._id, isActive);
  sendSuccess(res, `Recycling ${isActive ? 'resumed' : 'paused'}`, 200, plan);
}));

/**
 * POST /api/recycling/plans/:recycleId/performance
 * Update repost performance
 */
router.post('/plans/:recycleId/performance', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { postId, performance } = req.body;

  if (!postId || !performance) {
    return sendError(res, 'Post ID and performance data are required', 400);
  }

  const plan = await updateRepostPerformance(recycleId, postId, performance);
  sendSuccess(res, 'Performance updated', 200, plan);
}));

/**
 * GET /api/recycling/evergreen/:contentId
 * Check if content is evergreen
 */
router.get('/evergreen/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const result = await detectEvergreenContent(req.user._id, contentId);
  sendSuccess(res, 'Evergreen analysis complete', 200, result);
}));

/**
 * POST /api/recycling/bulk-create
 * Bulk create recycling plans
 */
router.post('/bulk-create', auth, asyncHandler(async (req, res) => {
  const { postIds, templateId } = req.body;

  if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
    return sendError(res, 'Post IDs array is required', 400);
  }

  const results = await bulkCreateRecyclingPlans(req.user._id, postIds, templateId);
  sendSuccess(res, 'Bulk recycling plans created', 200, results);
}));

/**
 * GET /api/recycling/analytics/advanced
 * Get advanced recycling analytics
 */
router.get('/analytics/advanced', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;
  const analytics = await getAdvancedAnalytics(req.user._id, parseInt(period));
  sendSuccess(res, 'Advanced analytics retrieved', 200, analytics);
}));

/**
 * POST /api/recycling/plans/:recycleId/detect-decay
 * Detect content decay
 */
router.post('/plans/:recycleId/detect-decay', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const result = await detectContentDecay(recycleId);
  sendSuccess(res, 'Decay detection complete', 200, result);
}));

/**
 * POST /api/recycling/plans/:recycleId/auto-adjust
 * Manually trigger auto-adjustment
 */
router.post('/plans/:recycleId/auto-adjust', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const result = await autoAdjustRecycling(recycleId);
  sendSuccess(res, 'Auto-adjustment complete', 200, result);
}));

/**
 * GET /api/recycling/:recycleId/optimize-timing
 * Optimize repost timing
 */
router.get('/:recycleId/optimize-timing', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { platform } = req.query;

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const timing = await optimizeRepostTiming(req.user._id, recycleId, platform || recycle.platform);
  sendSuccess(res, 'Timing optimized', 200, timing);
}));

/**
 * POST /api/recycling/:recycleId/refresh
 * Apply advanced refresh strategy
 */
router.post('/:recycleId/refresh', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { strategy = 'smart' } = req.body;

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const refresh = await applyAdvancedRefreshStrategy(recycleId, strategy);
  sendSuccess(res, 'Content refreshed', 200, refresh);
}));

/**
 * POST /api/recycling/:recycleId/optimize-multi-platform
 * Optimize multi-platform repost
 */
router.post('/:recycleId/optimize-multi-platform', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { platforms } = req.body;

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return sendError(res, 'Platforms array is required', 400);
  }

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const optimization = await optimizeMultiPlatformRepost(req.user._id, recycleId, platforms);
  sendSuccess(res, 'Multi-platform optimization completed', 200, optimization);
}));

/**
 * GET /api/recycling/analytics
 * Get repost analytics
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const { recycleId = null } = req.query;

  const analytics = await getRepostAnalytics(req.user._id, recycleId);
  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * POST /api/recycling/:recycleId/variations
 * Generate smart content variations
 */
router.post('/:recycleId/variations', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { count = 3 } = req.body;

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const variations = await generateSmartVariations(recycleId, count);
  sendSuccess(res, 'Variations generated', 200, variations);
}));

/**
 * GET /api/recycling/:recycleId/predict-performance
 * Predict repost performance
 */
router.get('/:recycleId/predict-performance', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const prediction = await predictRepostPerformance(req.user._id, recycleId);
  sendSuccess(res, 'Performance predicted', 200, prediction);
}));

/**
 * GET /api/recycling/roi
 * Analyze repost ROI
 */
router.get('/roi', auth, asyncHandler(async (req, res) => {
  const { recycleId = null } = req.query;

  const roi = await analyzeRepostROI(req.user._id, recycleId);
  sendSuccess(res, 'ROI analyzed', 200, roi);
}));

/**
 * POST /api/recycling/:recycleId/check-overlap
 * Detect audience overlap
 */
router.post('/:recycleId/check-overlap', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { scheduledTime } = req.body;

  if (!scheduledTime) {
    return sendError(res, 'Scheduled time is required', 400);
  }

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const overlap = await detectAudienceOverlap(req.user._id, recycleId, new Date(scheduledTime));
  sendSuccess(res, 'Overlap detected', 200, overlap);
}));

/**
 * GET /api/recycling/:recycleId/forecast
 * Forecast repost engagement
 */
router.get('/:recycleId/forecast', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { forecastDays = 30 } = req.query;

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const forecast = await forecastRepostEngagement(req.user._id, recycleId, parseInt(forecastDays));
  sendSuccess(res, 'Engagement forecasted', 200, forecast);
}));

/**
 * POST /api/recycling/:recycleId/check-conflicts
 * Detect scheduling conflicts
 */
router.post('/:recycleId/check-conflicts', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { proposedTime } = req.body;

  if (!proposedTime) {
    return sendError(res, 'Proposed time is required', 400);
  }

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const conflicts = await detectSchedulingConflicts(req.user._id, recycleId, new Date(proposedTime));
  sendSuccess(res, 'Conflicts detected', 200, conflicts);
}));

/**
 * POST /api/recycling/:recycleId/ab-test
 * Create repost A/B test
 */
router.post('/:recycleId/ab-test', auth, asyncHandler(async (req, res) => {
  const { recycleId } = req.params;
  const { variations = [] } = req.body;

  const ContentRecycle = require('../models/ContentRecycle');
  const recycle = await ContentRecycle.findOne({
    _id: recycleId,
    userId: req.user._id
  });

  if (!recycle) {
    return sendError(res, 'Recycling plan not found', 404);
  }

  const test = await createRepostABTest(req.user._id, recycleId, variations);
  sendSuccess(res, 'A/B test created', 201, test);
}));

/**
 * POST /api/recycling/alerts
 * Create repost alert
 */
router.post('/alerts', auth, asyncHandler(async (req, res) => {
  const alert = await createRepostAlert(req.user._id, req.body);
  sendSuccess(res, 'Alert created', 201, alert);
}));

/**
 * GET /api/recycling/alerts
 * Get user's repost alerts
 */
router.get('/alerts', auth, asyncHandler(async (req, res) => {
  const alerts = await getUserAlerts(req.user._id);
  sendSuccess(res, 'Alerts retrieved', 200, { alerts });
}));

/**
 * POST /api/recycling/alerts/:id/toggle
 * Toggle alert
 */
router.post('/alerts/:id/toggle', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const alert = await toggleAlert(id, req.user._id, isActive);
  sendSuccess(res, 'Alert updated', 200, alert);
}));

/**
 * DELETE /api/recycling/alerts/:id
 * Delete alert
 */
router.delete('/alerts/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await deleteAlert(id, req.user._id);
  sendSuccess(res, 'Alert deleted', 200);
}));

module.exports = router;


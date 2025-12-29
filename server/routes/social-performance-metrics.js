// Social Performance Metrics Routes
// Reach, impressions, engagement rates, audience growth

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  calculateEngagementRate,
  updateReachAndImpressions,
  updateEngagementBreakdown,
  getAggregatedPerformanceMetrics
} = require('../services/socialPerformanceMetricsService');
const {
  recordAudienceGrowth,
  getAudienceGrowthTrends
} = require('../services/socialPerformanceMetricsService');
const {
  syncAudienceGrowth,
  syncAllPlatformsAudienceGrowth
} = require('../services/audienceGrowthSyncService');
const router = express.Router();

/**
 * POST /api/posts/:postId/analytics/engagement-rate
 * Calculate engagement rate for post
 */
router.post('/:postId/analytics/engagement-rate', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { method = 'all' } = req.body;

  const result = await calculateEngagementRate(postId, { method });
  sendSuccess(res, 'Engagement rate calculated', 200, result);
}));

/**
 * PUT /api/posts/:postId/analytics/reach-impressions
 * Update reach and impressions
 */
router.put('/:postId/analytics/reach-impressions', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const analytics = await updateReachAndImpressions(postId, req.body);
  sendSuccess(res, 'Reach and impressions updated', 200, analytics);
}));

/**
 * PUT /api/posts/:postId/analytics/engagement-breakdown
 * Update engagement breakdown
 */
router.put('/:postId/analytics/engagement-breakdown', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const analytics = await updateEngagementBreakdown(postId, req.body);
  sendSuccess(res, 'Engagement breakdown updated', 200, analytics);
}));

/**
 * GET /api/workspaces/:workspaceId/performance-metrics
 * Get aggregated performance metrics
 */
router.get('/:workspaceId/performance-metrics', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const metrics = await getAggregatedPerformanceMetrics(workspaceId, req.query);
  sendSuccess(res, 'Performance metrics retrieved', 200, metrics);
}));

/**
 * POST /api/audience-growth/sync/:platform
 * Sync audience growth for platform
 */
router.post('/sync/:platform', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const growth = await syncAudienceGrowth(req.user._id, platform);
  sendSuccess(res, 'Audience growth synced', 200, growth);
}));

/**
 * POST /api/audience-growth/sync-all
 * Sync audience growth for all platforms
 */
router.post('/sync-all', auth, asyncHandler(async (req, res) => {
  const result = await syncAllPlatformsAudienceGrowth(req.user._id);
  sendSuccess(res, 'Audience growth synced for all platforms', 200, result);
}));

/**
 * GET /api/audience-growth/:platform/trends
 * Get audience growth trends
 */
router.get('/:platform/trends', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const trends = await getAudienceGrowthTrends(req.user._id, platform, req.query);
  sendSuccess(res, 'Audience growth trends retrieved', 200, trends);
}));

/**
 * POST /api/audience-growth/record
 * Manually record audience growth
 */
router.post('/record', auth, asyncHandler(async (req, res) => {
  const { platform, ...data } = req.body;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const growth = await recordAudienceGrowth(req.user._id, platform, {
    ...data,
    userId: req.user._id
  });

  sendSuccess(res, 'Audience growth recorded', 201, growth);
}));

module.exports = router;



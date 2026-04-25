// Content Insights Routes
// Top performing posts, video metrics, posting cadence

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { getTopPerformingPosts, updateContentPerformance } = require('../services/topPerformingPostsService');
const { updateVideoMetrics, getVideoMetricsAnalytics, getRetentionCurve } = require('../services/videoMetricsService');
const { analyzePostingCadence } = require('../services/postingCadenceService');
const router = express.Router();

/**
 * GET /api/workspaces/:workspaceId/content/top-performing
 * Get top performing posts
 */
router.get('/:workspaceId/content/top-performing', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const {
    metric = 'overall',
    limit = 10,
    platform,
    startDate,
    endDate,
    format,
    type,
    topic
  } = req.query;

  const result = await getTopPerformingPosts(workspaceId, {
    metric,
    limit: parseInt(limit),
    platform,
    startDate,
    endDate,
    format,
    type,
    topic
  });

  sendSuccess(res, 'Top performing posts retrieved', 200, result);
}));

/**
 * POST /api/posts/:postId/content-performance/update
 * Update content performance for a post
 */
router.post('/:postId/content-performance/update', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const performance = await updateContentPerformance(postId);
  sendSuccess(res, 'Content performance updated', 200, performance);
}));

/**
 * POST /api/posts/:postId/video-metrics
 * Update video metrics
 */
router.post('/:postId/video-metrics', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const metrics = await updateVideoMetrics(postId, req.body);
  sendSuccess(res, 'Video metrics updated', 200, metrics);
}));

/**
 * GET /api/workspaces/:workspaceId/video-metrics/analytics
 * Get video metrics analytics
 */
router.get('/:workspaceId/video-metrics/analytics', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const analytics = await getVideoMetricsAnalytics(workspaceId, req.query);
  sendSuccess(res, 'Video metrics analytics retrieved', 200, analytics);
}));

/**
 * GET /api/posts/:postId/video-metrics/retention
 * Get retention curve for a video
 */
router.get('/:postId/video-metrics/retention', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const retention = await getRetentionCurve(postId);
  sendSuccess(res, 'Retention curve retrieved', 200, retention);
}));

/**
 * POST /api/workspaces/:workspaceId/posting-cadence/analyze
 * Analyze posting cadence
 */
router.post('/:workspaceId/posting-cadence/analyze', auth, requireWorkspaceAccess('canView'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { period, ...filters } = req.body;

  if (!period || !period.startDate || !period.endDate) {
    return sendError(res, 'Period with startDate and endDate is required', 400);
  }

  const cadence = await analyzePostingCadence(workspaceId, period, filters);
  sendSuccess(res, 'Posting cadence analyzed', 200, cadence);
}));

module.exports = router;



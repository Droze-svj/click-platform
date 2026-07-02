// Unified Content Pipeline Routes
// One pipeline: long-form in → multi-format social across 6 networks out

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { clampInt } = require('../utils/pagination');
const {
  processContentPipeline,
  getPipelineStatus,
  publishAllNetworks,
  batchProcessPipeline,
  generateContentVariations,
  smartContentRefresh,
  getOptimalPostingTimes,
  scheduleWithOptimalTimes,
  setupABTesting,
  SUPPORTED_PLATFORMS
} = require('../services/unifiedContentPipelineService');

const router = express.Router();

/**
 * POST /api/pipeline/process
 * Process long-form content through unified pipeline
 */
router.post('/process', auth, asyncHandler(async (req, res) => {
  const { contentId, platforms, autoSchedule, enableRecycling, includePerformancePrediction, includeAnalytics } = req.body;

  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }

  const pipeline = await processContentPipeline(req.user._id, contentId, {
    platforms: platforms || SUPPORTED_PLATFORMS,
    autoSchedule: autoSchedule || false,
    enableRecycling: enableRecycling !== false, // Default true
    includePerformancePrediction: includePerformancePrediction !== false, // Default true
    includeAnalytics: includeAnalytics !== false // Default true
  });

  sendSuccess(res, 'Pipeline processing completed', 200, pipeline);
}));

/**
 * GET /api/pipeline/:contentId/status
 * Get pipeline status
 */
router.get('/:contentId/status', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const status = await getPipelineStatus(req.user._id, contentId);

  if (!status) {
    return sendError(res, 'Pipeline not found or not started', 404);
  }

  sendSuccess(res, 'Pipeline status retrieved', 200, status);
}));

/**
 * POST /api/pipeline/:contentId/publish
 * Publish all assets to all 6 networks (one-click)
 */
router.post('/:contentId/publish', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platforms, schedule } = req.body;

  const results = await publishAllNetworks(req.user._id, contentId, {
    platforms: platforms || SUPPORTED_PLATFORMS,
    schedule: schedule || false
  });

  sendSuccess(res, 'Publishing completed', 200, results);
}));

/**
 * GET /api/pipeline/platforms
 * Get supported platforms
 */
router.get('/platforms', auth, asyncHandler(async (req, res) => {
  sendSuccess(res, 'Supported platforms', 200, {
    platforms: SUPPORTED_PLATFORMS,
    count: SUPPORTED_PLATFORMS.length
  });
}));

/**
 * POST /api/pipeline/batch
 * Batch process multiple content items
 */
router.post('/batch', auth, asyncHandler(async (req, res) => {
  const { contentIds, platforms, autoSchedule, enableRecycling, includePerformancePrediction, includeAnalytics, parallel } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  // Each content id fans out into a full multi-platform pipeline of paid LLM
  // calls. Cap the batch so an unbounded contentIds array can't be a cost/DoS
  // bomb; callers with more items must page through in chunks.
  if (contentIds.length > 25) {
    return sendError(res, 'Batch is limited to 25 content items per request', 400);
  }

  const results = await batchProcessPipeline(req.user._id, contentIds, {
    platforms: platforms || SUPPORTED_PLATFORMS,
    autoSchedule: autoSchedule || false,
    enableRecycling: enableRecycling !== false,
    includePerformancePrediction: includePerformancePrediction !== false,
    includeAnalytics: includeAnalytics !== false,
    parallel: parallel || false
  });

  sendSuccess(res, 'Batch processing completed', 200, results);
}));

/**
 * POST /api/pipeline/:contentId/variations
 * Generate content variations for A/B testing
 */
router.post('/:contentId/variations', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platform } = req.body;
  // Clamp the fan-out: each variation is a paid LLM call, so an unclamped body
  // `count` (e.g. 100000) was a cost bomb.
  const count = clampInt(req.body.count, 3, 5, 1);

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const variations = await generateContentVariations(req.user._id, contentId, platform, count);
  sendSuccess(res, 'Variations generated', 200, { variations });
}));

/**
 * POST /api/pipeline/:contentId/refresh
 * Smart content refresh
 */
router.post('/:contentId/refresh', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { updateHashtags, updateCaptions, optimizeForTrends, usePerformanceData } = req.body;

  const refreshed = await smartContentRefresh(req.user._id, contentId, {
    updateHashtags: updateHashtags !== false,
    updateCaptions: updateCaptions || false,
    optimizeForTrends: optimizeForTrends !== false,
    usePerformanceData: usePerformanceData !== false
  });

  sendSuccess(res, 'Content refreshed', 200, { refreshed });
}));

/**
 * GET /api/pipeline/optimal-times
 * Get optimal posting times for all platforms
 */
router.get('/optimal-times', auth, asyncHandler(async (req, res) => {
  const { platforms } = req.query;
  const platformList = platforms ? platforms.split(',') : SUPPORTED_PLATFORMS;

  const optimalTimes = await getOptimalPostingTimes(req.user._id, platformList);
  sendSuccess(res, 'Optimal times retrieved', 200, { optimalTimes });
}));

/**
 * POST /api/pipeline/:contentId/schedule-optimal
 * Schedule with optimal posting times
 */
router.post('/:contentId/schedule-optimal', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platforms } = req.body;

  const result = await scheduleWithOptimalTimes(req.user._id, contentId, platforms || SUPPORTED_PLATFORMS);
  sendSuccess(res, 'Scheduled with optimal times', 200, result);
}));

/**
 * POST /api/pipeline/:contentId/ab-test
 * Setup A/B testing
 */
router.post('/:contentId/ab-test', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platform, variations } = req.body;

  if (!platform || !variations || !Array.isArray(variations)) {
    return sendError(res, 'Platform and variations array are required', 400);
  }

  const abTest = await setupABTesting(req.user._id, contentId, platform, variations);
  sendSuccess(res, 'A/B testing setup', 200, abTest);
}));

module.exports = router;


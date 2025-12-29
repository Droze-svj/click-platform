// Advanced Recycling Routes
// Evergreen detection, A/B variants, always-on libraries

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  detectEvergreenContent,
  buildRecyclingCalendar,
  autoBuildRecyclingCalendar,
  detectSeasonalEvergreen,
  predictEvergreenPotential,
  optimizeRecyclingCalendar,
  calculateContentFreshness
} = require('../services/advancedEvergreenService');
const {
  generateABVariants,
  trackABTestResults,
  checkStatisticalSignificance,
  autoSelectWinner,
  predictVariantPerformance,
  learnFromCrossPlatformVariants
} = require('../services/abVariantService');
const {
  createAlwaysOnLibrary,
  addContentToLibrary,
  checkContentPerformance,
  scheduleNextPost,
  autoAddHighPerformingContent,
  getLibraryAnalytics,
  refreshExpiredContent
} = require('../services/alwaysOnLibraryService');

const router = express.Router();

/**
 * POST /api/recycling-advanced/evergreen/detect
 * Detect evergreen content
 */
router.post('/evergreen/detect', auth, asyncHandler(async (req, res) => {
  const evergreen = await detectEvergreenContent(req.user._id, req.body);
  sendSuccess(res, 'Evergreen content detected', 200, evergreen);
}));

/**
 * POST /api/recycling-advanced/evergreen/build-calendar
 * Auto-build recycling calendar
 */
router.post('/evergreen/build-calendar', auth, asyncHandler(async (req, res) => {
  const result = await autoBuildRecyclingCalendar(req.user._id, req.body);
  sendSuccess(res, 'Recycling calendar built', 200, result);
}));

/**
 * POST /api/recycling-advanced/ab-variants/generate
 * Generate A/B variants
 */
router.post('/ab-variants/generate', auth, asyncHandler(async (req, res) => {
  const { baseContentId, ...options } = req.body;

  if (!baseContentId) {
    return sendError(res, 'Base content ID is required', 400);
  }

  const variants = await generateABVariants(req.user._id, baseContentId, options);
  sendSuccess(res, 'A/B variants generated', 200, variants);
}));

/**
 * POST /api/recycling-advanced/ab-variants/track
 * Track A/B test results
 */
router.post('/ab-variants/track', auth, asyncHandler(async (req, res) => {
  const { testId, variantResults } = req.body;

  if (!testId || !variantResults) {
    return sendError(res, 'Test ID and variant results are required', 400);
  }

  const results = await trackABTestResults(testId, variantResults);
  sendSuccess(res, 'A/B test results tracked', 200, results);
}));

/**
 * POST /api/recycling-advanced/always-on/create
 * Create always-on library
 */
router.post('/always-on/create', auth, asyncHandler(async (req, res) => {
  const library = await createAlwaysOnLibrary(req.user._id, req.body);
  sendSuccess(res, 'Always-on library created', 201, library);
}));

/**
 * POST /api/recycling-advanced/always-on/:libraryId/content
 * Add content to library
 */
router.post('/always-on/:libraryId/content', auth, asyncHandler(async (req, res) => {
  const { libraryId } = req.params;
  const { contentIds } = req.body;

  if (!contentIds) {
    return sendError(res, 'Content IDs are required', 400);
  }

  const result = await addContentToLibrary(libraryId, contentIds, req.user._id);
  sendSuccess(res, 'Content added to library', 200, result);
}));

/**
 * POST /api/recycling-advanced/always-on/:libraryId/check-performance
 * Check content performance
 */
router.post('/always-on/:libraryId/check-performance', auth, asyncHandler(async (req, res) => {
  const { libraryId } = req.params;
  const result = await checkContentPerformance(libraryId);
  sendSuccess(res, 'Performance checked', 200, result);
}));

/**
 * POST /api/recycling-advanced/always-on/:libraryId/schedule-next
 * Schedule next post
 */
router.post('/always-on/:libraryId/schedule-next', auth, asyncHandler(async (req, res) => {
  const { libraryId } = req.params;
  const result = await scheduleNextPost(libraryId);
  sendSuccess(res, 'Next post scheduled', 200, result);
}));

/**
 * POST /api/recycling-advanced/evergreen/seasonal
 * Detect seasonal evergreen content
 */
router.post('/evergreen/seasonal', auth, asyncHandler(async (req, res) => {
  const { season = null } = req.body;
  const seasonal = await detectSeasonalEvergreen(req.user._id, season);
  sendSuccess(res, 'Seasonal evergreen detected', 200, seasonal);
}));

/**
 * POST /api/recycling-advanced/evergreen/predict
 * Predict evergreen potential
 */
router.post('/evergreen/predict', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.body;
  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }
  const prediction = await predictEvergreenPotential(req.user._id, contentId);
  sendSuccess(res, 'Evergreen potential predicted', 200, prediction);
}));

/**
 * POST /api/recycling-advanced/evergreen/optimize-calendar
 * Optimize recycling calendar
 */
router.post('/evergreen/optimize-calendar', auth, asyncHandler(async (req, res) => {
  const { calendar } = req.body;
  if (!calendar) {
    return sendError(res, 'Calendar is required', 400);
  }
  const optimized = await optimizeRecyclingCalendar(req.user._id, calendar);
  sendSuccess(res, 'Calendar optimized', 200, optimized);
}));

/**
 * POST /api/recycling-advanced/evergreen/freshness
 * Calculate content freshness
 */
router.post('/evergreen/freshness', auth, asyncHandler(async (req, res) => {
  const { contentId, lastPostedDate } = req.body;
  if (!contentId || !lastPostedDate) {
    return sendError(res, 'Content ID and last posted date are required', 400);
  }
  const freshness = await calculateContentFreshness(contentId, lastPostedDate);
  sendSuccess(res, 'Content freshness calculated', 200, freshness);
}));

/**
 * POST /api/recycling-advanced/ab-variants/significance
 * Check statistical significance
 */
router.post('/ab-variants/significance', auth, asyncHandler(async (req, res) => {
  const { variantResults, confidenceLevel = 0.95 } = req.body;
  if (!variantResults) {
    return sendError(res, 'Variant results are required', 400);
  }
  const significance = checkStatisticalSignificance(variantResults, confidenceLevel);
  sendSuccess(res, 'Statistical significance checked', 200, significance);
}));

/**
 * POST /api/recycling-advanced/ab-variants/auto-winner
 * Auto-select winner
 */
router.post('/ab-variants/auto-winner', auth, asyncHandler(async (req, res) => {
  const { testId, variantResults, ...options } = req.body;
  if (!testId || !variantResults) {
    return sendError(res, 'Test ID and variant results are required', 400);
  }
  const result = await autoSelectWinner(testId, variantResults, options);
  sendSuccess(res, 'Winner selected', 200, result);
}));

/**
 * POST /api/recycling-advanced/ab-variants/predict
 * Predict variant performance
 */
router.post('/ab-variants/predict', auth, asyncHandler(async (req, res) => {
  const { baseContentId, variant, historicalData = null } = req.body;
  if (!baseContentId || !variant) {
    return sendError(res, 'Base content ID and variant are required', 400);
  }
  const prediction = await predictVariantPerformance(baseContentId, variant, historicalData);
  sendSuccess(res, 'Variant performance predicted', 200, prediction);
}));

/**
 * POST /api/recycling-advanced/ab-variants/cross-platform-learning
 * Learn from cross-platform variants
 */
router.post('/ab-variants/cross-platform-learning', auth, asyncHandler(async (req, res) => {
  const { baseContentId } = req.body;
  if (!baseContentId) {
    return sendError(res, 'Base content ID is required', 400);
  }
  const learnings = await learnFromCrossPlatformVariants(req.user._id, baseContentId);
  sendSuccess(res, 'Cross-platform learnings retrieved', 200, { learnings });
}));

/**
 * POST /api/recycling-advanced/always-on/:libraryId/auto-add
 * Auto-add high-performing content
 */
router.post('/always-on/:libraryId/auto-add', auth, asyncHandler(async (req, res) => {
  const { libraryId } = req.params;
  const result = await autoAddHighPerformingContent(libraryId, req.body);
  sendSuccess(res, 'Content auto-added', 200, result);
}));

/**
 * GET /api/recycling-advanced/always-on/:libraryId/analytics
 * Get library analytics
 */
router.get('/always-on/:libraryId/analytics', auth, asyncHandler(async (req, res) => {
  const { libraryId } = req.params;
  const analytics = await getLibraryAnalytics(libraryId);
  sendSuccess(res, 'Library analytics retrieved', 200, analytics);
}));

/**
 * POST /api/recycling-advanced/always-on/:libraryId/refresh
 * Refresh expired content
 */
router.post('/always-on/:libraryId/refresh', auth, asyncHandler(async (req, res) => {
  const { libraryId } = req.params;
  const result = await refreshExpiredContent(libraryId, req.body);
  sendSuccess(res, 'Content refreshed', 200, result);
}));

module.exports = router;


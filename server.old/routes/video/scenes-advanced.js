// Advanced Scene Detection Routes
// Preview, validation, recommendations, and performance monitoring

const express = require('express');
const auth = require('../../middleware/auth');
const {
  validateAllScenes,
  validateScenes
} = require('../../services/sceneValidationService');
const {
  getAdaptiveRecommendations,
  learnOptimalSensitivity,
  updateWorkspaceWithLearnedValues
} = require('../../services/adaptiveThresholdService');
const {
  getPerformanceMetrics,
  getPerformanceTrends,
  detectPerformanceIssues,
  getCostEstimates
} = require('../../services/scenePerformanceMonitor');
const { detectScenes } = require('../../services/sceneDetectionService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/preview
 * @desc Preview scene detection without saving
 * @access Private
 */
router.post('/preview', auth, asyncHandler(async (req, res) => {
  const { videoUrl, videoId, ...options } = req.body;

  if (!videoUrl && !videoId) {
    return sendError(res, 'Either videoUrl or videoId is required', 400);
  }

  try {
    const videoUrlOrId = videoId || videoUrl;
    
    // Run detection with validation but don't save
    const result = await detectScenes(videoUrlOrId, {
      ...options,
      userId: req.user._id.toString(),
      useCache: false, // Don't use cache for preview
      extractMetadata: options.extractMetadata !== false
    });

    // Validate results
    const validation = validateAllScenes(result.scenes, {
      minLength: options.minSceneLength || 1.0,
      maxLength: options.maxSceneLength || null,
      deduplicate: true
    });

    sendSuccess(res, 'Scene preview generated', 200, {
      ...result,
      validation
    });
  } catch (error) {
    logger.error('Error generating scene preview', { error: error.message });
    sendError(res, error.message || 'Failed to generate preview', 500);
  }
}));

/**
 * @route POST /api/video/scenes/validate
 * @desc Validate scene boundaries
 * @access Private
 */
router.post('/validate', auth, asyncHandler(async (req, res) => {
  const { scenes, options } = req.body;

  if (!scenes || !Array.isArray(scenes)) {
    return sendError(res, 'Scenes array is required', 400);
  }

  try {
    const validation = validateAllScenes(scenes, options || {});
    sendSuccess(res, 'Scenes validated', 200, validation);
  } catch (error) {
    logger.error('Error validating scenes', { error: error.message });
    sendError(res, error.message || 'Failed to validate scenes', 500);
  }
}));

/**
 * @route GET /api/video/scenes/recommendations/:contentId
 * @desc Get adaptive recommendations for content
 * @access Private
 */
router.get('/recommendations/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const workspaceId = req.user.workspace?.toString();

  if (!workspaceId) {
    return sendError(res, 'Workspace required for recommendations', 400);
  }

  try {
    const recommendations = await getAdaptiveRecommendations(workspaceId, contentId);
    sendSuccess(res, 'Recommendations retrieved', 200, recommendations);
  } catch (error) {
    logger.error('Error getting recommendations', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to get recommendations', 500);
  }
}));

/**
 * @route GET /api/video/scenes/performance/:workspaceId
 * @desc Get performance metrics
 * @access Private
 */
router.get('/performance/:workspaceId', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { days = 7 } = req.query;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const metrics = await getPerformanceMetrics(workspaceId, parseInt(days));
    sendSuccess(res, 'Performance metrics retrieved', 200, metrics);
  } catch (error) {
    logger.error('Error getting performance metrics', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to get metrics', 500);
  }
}));

/**
 * @route GET /api/video/scenes/performance/:workspaceId/trends
 * @desc Get performance trends
 * @access Private
 */
router.get('/performance/:workspaceId/trends', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { days = 30 } = req.query;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const trends = await getPerformanceTrends(workspaceId, parseInt(days));
    sendSuccess(res, 'Performance trends retrieved', 200, { trends });
  } catch (error) {
    logger.error('Error getting performance trends', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to get trends', 500);
  }
}));

/**
 * @route GET /api/video/scenes/performance/:workspaceId/issues
 * @desc Detect performance issues
 * @access Private
 */
router.get('/performance/:workspaceId/issues', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const issues = await detectPerformanceIssues(workspaceId);
    sendSuccess(res, 'Performance issues detected', 200, issues);
  } catch (error) {
    logger.error('Error detecting performance issues', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to detect issues', 500);
  }
}));

/**
 * @route GET /api/video/scenes/cost/:workspaceId
 * @desc Get cost estimates
 * @access Private
 */
router.get('/cost/:workspaceId', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { days = 30 } = req.query;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const costs = await getCostEstimates(workspaceId, parseInt(days));
    sendSuccess(res, 'Cost estimates retrieved', 200, costs);
  } catch (error) {
    logger.error('Error getting cost estimates', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to get cost estimates', 500);
  }
}));

/**
 * @route POST /api/video/scenes/learn/:workspaceId
 * @desc Trigger learning from user edits
 * @access Private
 */
router.post('/learn/:workspaceId', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const updates = await updateWorkspaceWithLearnedValues(workspaceId);
    sendSuccess(res, 'Learning completed', 200, { updates });
  } catch (error) {
    logger.error('Error learning from edits', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to learn from edits', 500);
  }
}));

module.exports = router;








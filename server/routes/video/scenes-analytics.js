// Scene Detection Analytics Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getWorkspaceAnalytics,
  getDetectionEffectivenessMetrics,
  getRecommendedSensitivity
} = require('../../services/sceneDetectionAnalyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route GET /api/video/scenes/analytics/:workspaceId
 * @desc Get workspace analytics
 * @access Private
 */
router.get('/analytics/:workspaceId', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { startDate, endDate } = req.query;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const analytics = await getWorkspaceAnalytics(workspaceId, startDate, endDate);
    sendSuccess(res, 'Analytics retrieved successfully', 200, analytics);
  } catch (error) {
    logger.error('Error getting analytics', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to get analytics', 500);
  }
}));

/**
 * @route GET /api/video/scenes/analytics/:workspaceId/effectiveness
 * @desc Get detection effectiveness metrics
 * @access Private
 */
router.get('/analytics/:workspaceId/effectiveness', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { days = 30 } = req.query;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const metrics = await getDetectionEffectivenessMetrics(workspaceId, parseInt(days));
    sendSuccess(res, 'Effectiveness metrics retrieved', 200, { metrics });
  } catch (error) {
    logger.error('Error getting effectiveness metrics', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to get metrics', 500);
  }
}));

/**
 * @route GET /api/video/scenes/analytics/:workspaceId/recommended-sensitivity
 * @desc Get recommended sensitivity based on analytics
 * @access Private
 */
router.get('/analytics/:workspaceId/recommended-sensitivity', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const sensitivity = await getRecommendedSensitivity(workspaceId);
    sendSuccess(res, 'Recommended sensitivity retrieved', 200, { sensitivity });
  } catch (error) {
    logger.error('Error getting recommended sensitivity', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to get recommendation', 500);
  }
}));

module.exports = router;








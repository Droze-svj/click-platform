// Workspace Scene Detection Settings Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getWorkspaceSettings,
  updateWorkspaceSettings
} = require('../../services/workspaceSceneSettingsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route GET /api/video/scenes/settings/:workspaceId
 * @desc Get workspace scene detection settings
 * @access Private
 */
router.get('/settings/:workspaceId', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const settings = await getWorkspaceSettings(workspaceId);
    sendSuccess(res, 'Settings retrieved successfully', 200, settings);
  } catch (error) {
    logger.error('Error getting workspace settings', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to get settings', 500);
  }
}));

/**
 * @route PUT /api/video/scenes/settings/:workspaceId
 * @desc Update workspace scene detection settings
 * @access Private
 */
router.put('/settings/:workspaceId', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const updates = req.body;

  // Verify user has access to workspace
  if (req.user.workspace?.toString() !== workspaceId) {
    return sendError(res, 'Access denied', 403);
  }

  // Validate updates
  const allowedFields = [
    'defaultSensitivity',
    'defaultMinSceneLength',
    'defaultMaxSceneLength',
    'transcriptLanguage',
    'enableMultiModal',
    'enableAudioAnalysis',
    'enableTextSegmentation',
    'enableAdvancedAudioAnalysis',
    'disableHeavyAIAnalysis',
    'autoDetectOnUpload',
    'autoDetectMaxDuration',
    'defaultWorkflowType'
  ];

  const validUpdates = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      validUpdates[field] = updates[field];
    }
  }

  try {
    const settings = await updateWorkspaceSettings(workspaceId, validUpdates);
    sendSuccess(res, 'Settings updated successfully', 200, settings);
  } catch (error) {
    logger.error('Error updating workspace settings', { error: error.message, workspaceId });
    sendError(res, error.message || 'Failed to update settings', 500);
  }
}));

module.exports = router;








// Scene Detection Job Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  createSceneDetectionJob,
  getJobStatus,
  getJobStatusByContent,
  cancelJob,
  rerunSceneDetection
} = require('../../services/sceneDetectionJobService');
const {
  getWorkspaceSettings,
  applyWorkspaceSettings
} = require('../../services/workspaceSceneSettingsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @route POST /api/video/scenes/job
 * @desc Create async scene detection job
 * @access Private
 */
router.post('/job', auth, asyncHandler(async (req, res) => {
  const { contentId, workspaceId, ...options } = req.body;

  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }

  try {
    // Get workspace settings and apply them
    let appliedOptions = { ...options };
    if (workspaceId || req.user.workspace) {
      const workspace = workspaceId || req.user.workspace;
      const settings = await getWorkspaceSettings(workspace);
      appliedOptions = applyWorkspaceSettings(appliedOptions, settings);
    }

    const job = await createSceneDetectionJob(
      contentId,
      req.user._id.toString(),
      workspaceId || req.user.workspace?.toString(),
      appliedOptions
    );

    sendSuccess(res, 'Scene detection job created', 202, {
      jobId: job._id,
      status: job.status,
      contentId: job.contentId
    });
  } catch (error) {
    logger.error('Error creating scene detection job', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to create scene detection job', 500);
  }
}));

/**
 * @route GET /api/video/scenes/job/:jobId
 * @desc Get job status
 * @access Private
 */
router.get('/job/:jobId', auth, asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await getJobStatus(jobId, req.user._id);
    sendSuccess(res, 'Job status retrieved', 200, job);
  } catch (error) {
    logger.error('Error getting job status', { error: error.message, jobId });
    sendError(res, error.message || 'Failed to get job status', 500);
  }
}));

/**
 * @route GET /api/video/scenes/job/content/:contentId
 * @desc Get latest job status for content
 * @access Private
 */
router.get('/job/content/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const job = await getJobStatusByContent(contentId, req.user._id);
    if (!job) {
      return sendSuccess(res, 'No job found for content', 200, { status: 'not_found' });
    }
    sendSuccess(res, 'Job status retrieved', 200, job);
  } catch (error) {
    logger.error('Error getting job status by content', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to get job status', 500);
  }
}));

/**
 * @route POST /api/video/scenes/job/:jobId/cancel
 * @desc Cancel a scene detection job
 * @access Private
 */
router.post('/job/:jobId/cancel', auth, asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await cancelJob(jobId, req.user._id);
    sendSuccess(res, 'Job cancelled successfully', 200, job);
  } catch (error) {
    logger.error('Error cancelling job', { error: error.message, jobId });
    sendError(res, error.message || 'Failed to cancel job', 500);
  }
}));

/**
 * @route POST /api/video/scenes/rerun/:contentId
 * @desc Re-run scene detection with new parameters
 * @access Private
 */
router.post('/rerun/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { workspaceId, ...options } = req.body;

  try {
    // Get workspace settings and apply them
    let appliedOptions = { ...options };
    if (workspaceId || req.user.workspace) {
      const workspace = workspaceId || req.user.workspace;
      const settings = await getWorkspaceSettings(workspace);
      appliedOptions = applyWorkspaceSettings(appliedOptions, settings);
    }

    const job = await rerunSceneDetection(
      contentId,
      req.user._id.toString(),
      workspaceId || req.user.workspace?.toString(),
      appliedOptions
    );

    sendSuccess(res, 'Scene detection re-run started', 202, {
      jobId: job._id,
      status: job.status,
      contentId: job.contentId
    });
  } catch (error) {
    logger.error('Error re-running scene detection', { error: error.message, contentId });
    sendError(res, error.message || 'Failed to re-run scene detection', 500);
  }
}));

module.exports = router;








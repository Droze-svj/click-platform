// Video processing progress routes

const express = require('express');
const auth = require('../../middleware/auth');
const progressTracker = require('../../services/videoProgressService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const { guardOwnership } = require('../../utils/ownership');
const router = express.Router();

/**
 * @swagger
 * /api/video/progress/:videoId:
 *   get:
 *     summary: Get video processing progress
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { operation } = req.query;

  // IDOR guard: progress (and its completion `result`) is keyed only by videoId,
  // so without this any authed user could poll another tenant's job by guessing
  // the id. Verify the requester owns the content first.
  const content = await guardOwnership(req, res, videoId);
  if (!content) return;

  try {
    if (operation) {
      const progress = progressTracker.getProgress(videoId, operation);
      if (progress) {
        sendSuccess(res, 'Progress fetched', 200, progress);
      } else {
        sendError(res, 'Progress not found', 404);
      }
    } else {
      // Get all operations for this video
      const activeOps = progressTracker.getActiveOperations().filter(
        op => op.videoId === videoId
      );
      sendSuccess(res, 'Progress fetched', 200, activeOps);
    }
  } catch (error) {
    sendError(res, error.message, 500);
  }
}));

/**
 * GET /api/video/progress  — REMOVED.
 * This returned getActiveOperations() for EVERY tenant (cross-tenant disclosure
 * of job status + completion results). The progress records carry no userId to
 * filter by, and the client only ever polls /:videoId, so the global listing is
 * gone. Poll the per-video, ownership-checked route above instead.
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  return sendError(res, 'Global progress listing is not available; query /api/video/progress/:videoId.', 410);
}));

module.exports = router;







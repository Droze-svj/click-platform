// Video processing progress routes

const express = require('express');
const auth = require('../../middleware/auth');
const progressTracker = require('../../services/videoProgressService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
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
 * @swagger
 * /api/video/progress:
 *   get:
 *     summary: Get all active video processing operations
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  try {
    const activeOps = progressTracker.getActiveOperations();
    sendSuccess(res, 'Active operations fetched', 200, activeOps);
  } catch (error) {
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







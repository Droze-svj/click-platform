// Real-time Collaboration Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  joinEditingSession,
  leaveEditingSession,
  updateCursor,
  handleContentChange,
  getActiveUsers,
  sendRealtimeComment,
} = require('../../services/realtimeCollaborationService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/collaboration/realtime/:contentId/join:
 *   post:
 *     summary: Join real-time editing session
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/join', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const socketId = req.body.socketId || req.headers['x-socket-id'];

  try {
    const result = await joinEditingSession(
      contentId,
      req.user._id,
      socketId
    );
    sendSuccess(res, 'Joined editing session', 200, result);
  } catch (error) {
    logger.error('Join session error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/realtime/:contentId/leave:
 *   post:
 *     summary: Leave real-time editing session
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/leave', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    await leaveEditingSession(contentId, req.user._id);
    sendSuccess(res, 'Left editing session', 200);
  } catch (error) {
    logger.error('Leave session error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/realtime/:contentId/cursor:
 *   post:
 *     summary: Update cursor position
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/cursor', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { cursor } = req.body;

  try {
    updateCursor(contentId, req.user._id, cursor);
    sendSuccess(res, 'Cursor updated', 200);
  } catch (error) {
    logger.error('Update cursor error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/realtime/:contentId/change:
 *   post:
 *     summary: Handle content change
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/change', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { operation, version, content, index, text, length } = req.body;

  try {
    const result = await handleContentChange(contentId, req.user._id, {
      operation,
      version,
      content,
      index,
      text,
      length,
    });
    sendSuccess(res, 'Content change applied', 200, result);
  } catch (error) {
    logger.error('Handle change error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/realtime/:contentId/users:
 *   get:
 *     summary: Get active users in session
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId/users', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  try {
    const userIds = getActiveUsers(contentId);
    sendSuccess(res, 'Active users fetched', 200, { userIds });
  } catch (error) {
    logger.error('Get active users error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/collaboration/realtime/:contentId/comment:
 *   post:
 *     summary: Send real-time comment
 *     tags: [Collaboration]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/comment', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { text, position } = req.body;

  if (!text) {
    return sendError(res, 'Comment text is required', 400);
  }

  try {
    await sendRealtimeComment(contentId, req.user._id, {
      text,
      position,
    });
    sendSuccess(res, 'Comment sent', 200);
  } catch (error) {
    logger.error('Send comment error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







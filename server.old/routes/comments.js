const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { getIO } = require('../services/socketService');
const auth = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/comments
 * Fetch comments for an entity
 */
router.get('/', auth, async (req, res) => {
  const { entityId } = req.query;
  try {
    const comments = await Comment.find({ entityId })
      .sort({ createdAt: 1 })
      .limit(100);
    sendSuccess(res, 'Comments retrieved', 200, comments);
  } catch (err) {
    sendError(res, err.message, 500);
  }
});

/**
 * POST /api/comments
 * Create a new comment
 */
router.post('/', auth, async (req, res) => {
  const { teamId, entityId, entityType, text, userName, parentId } = req.body;
  try {
    const comment = await Comment.create({
      userId: req.user._id || req.user.id,
      userName,
      teamId,
      entityId,
      entityType,
      text,
      parentId
    });

    // Broadcast to room if entityId is treated as a room
    const io = getIO();
    io.emit(`comment:${entityId}`, comment);

    sendSuccess(res, 'Comment created', 201, comment);
  } catch (err) {
    sendError(res, err.message, 500);
  }
});

module.exports = router;

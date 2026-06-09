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
  // Validation — the route previously accepted empty text / missing entityId.
  if (!entityId || !text || !String(text).trim()) {
    return sendError(res, 'entityId and non-empty text are required', 400);
  }
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

    // SECURITY: scope the broadcast to a per-entity room instead of io.emit(),
    // which sent every comment (text + author) to ALL connected sockets — a
    // cross-entity info leak. Consumers join `comments:<entityId>` (that join
    // should be access-checked like join:room). No current client listened to
    // the old global `comment:<id>` event, so this is non-breaking.
    try {
      getIO().to(`comments:${entityId}`).emit('comment:new', comment);
    } catch (_) { /* socket layer optional */ }

    sendSuccess(res, 'Comment created', 201, comment);
  } catch (err) {
    sendError(res, err.message, 500);
  }
});

module.exports = router;

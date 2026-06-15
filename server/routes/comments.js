const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { getIO } = require('../services/socketService');
const auth = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const { teamAccessible, accessibleContent } = require('../utils/resourceAccess');

/**
 * GET /api/comments?entityId=&teamId=&entityType=
 * Fetch comments for an entity within a team the caller belongs to.
 */
router.get('/', auth, async (req, res) => {
  const { entityId, teamId, entityType } = req.query;
  if (!entityId || !teamId) {
    return sendError(res, 'entityId and teamId are required', 400);
  }
  // Comments are team-scoped (Comment.teamId is required), so team membership is
  // the access boundary. Without this, GET returned EVERY team's comments for an
  // entityId — a cross-tenant leak of comment text + author. Scoping the query to
  // { teamId, entityId } (was { entityId }) plus the membership check closes it.
  if (!(await teamAccessible(req, teamId))) {
    return sendError(res, 'Not found', 404);
  }
  // Defense-in-depth: a `content` comment must reference content the caller can
  // actually access (owner or workspace), not just any id.
  if (entityType === 'content' && !(await accessibleContent(req, entityId))) {
    return sendError(res, 'Not found', 404);
  }
  try {
    const comments = await Comment.find({ teamId, entityId })
      .sort({ createdAt: 1 })
      .limit(100);
    sendSuccess(res, 'Comments retrieved', 200, comments);
  } catch (err) {
    sendError(res, err.message, 500);
  }
});

/**
 * POST /api/comments
 * Create a new comment in a team the caller belongs to.
 */
router.post('/', auth, async (req, res) => {
  const { teamId, entityId, entityType, text, userName, parentId } = req.body;
  // Validation — the route previously accepted empty text / missing entityId.
  if (!entityId || !teamId || !text || !String(text).trim()) {
    return sendError(res, 'entityId, teamId and non-empty text are required', 400);
  }
  // Membership gate. This also closes the teamId mass-assignment: the teamId came
  // straight from the body, so a caller could post into ANY team's comment thread;
  // now they must belong to it.
  if (!(await teamAccessible(req, teamId))) {
    return sendError(res, 'Not found', 404);
  }
  if (entityType === 'content' && !(await accessibleContent(req, entityId))) {
    return sendError(res, 'Not found', 404);
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
    // which sent every comment (text + author) to ALL connected sockets. Consumers
    // join `comments:<entityId>` — that room join should be access-checked too
    // (same team-membership rule) in the socket layer.
    try {
      getIO().to(`comments:${entityId}`).emit('comment:new', comment);
    } catch (_) { /* socket layer optional */ }

    sendSuccess(res, 'Comment created', 201, comment);
  } catch (err) {
    sendError(res, err.message, 500);
  }
});

module.exports = router;

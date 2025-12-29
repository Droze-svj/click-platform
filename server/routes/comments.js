// Comments and reviews routes

const express = require('express');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Get comments for entity
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { entityType, entityId, teamId } = req.query;

  if (!entityType || !entityId) {
    return sendError(res, 'entityType and entityId are required', 400);
  }

  const query = { entityType, entityId };
  if (teamId) {
    query.teamId = teamId;
  }

  const comments = await Comment.find(query)
    .populate('userId', 'name email')
    .populate('mentions', 'name email')
    .populate('parentCommentId')
    .sort({ createdAt: 1 });

  sendSuccess(res, 'Comments fetched', 200, comments);
}));

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const { entityType, entityId, text, mentions, parentCommentId, teamId } = req.body;

  if (!entityType || !entityId || !text) {
    return sendError(res, 'entityType, entityId, and text are required', 400);
  }

  const comment = new Comment({
    entityType,
    entityId,
    userId: req.user._id,
    teamId: teamId || null,
    text,
    mentions: mentions || [],
    parentCommentId: parentCommentId || null
  });

  await comment.save();
  await comment.populate('userId', 'name email');

  sendSuccess(res, 'Comment created', 201, comment);
}));

/**
 * @swagger
 * /api/comments/{commentId}:
 *   put:
 *     summary: Update comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:commentId', auth, asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    userId: req.user._id
  });

  if (!comment) {
    return sendError(res, 'Comment not found', 404);
  }

  if (req.body.text) comment.text = req.body.text;
  if (req.body.isResolved !== undefined) comment.isResolved = req.body.isResolved;

  await comment.save();
  sendSuccess(res, 'Comment updated', 200, comment);
}));

/**
 * @swagger
 * /api/comments/{commentId}:
 *   delete:
 *     summary: Delete comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:commentId', auth, asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    userId: req.user._id
  });

  if (!comment) {
    return sendError(res, 'Comment not found', 404);
  }

  await comment.deleteOne();
  sendSuccess(res, 'Comment deleted', 200);
}));

/**
 * @swagger
 * /api/comments/{commentId}/reaction:
 *   post:
 *     summary: Add reaction to comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:commentId/reaction', auth, asyncHandler(async (req, res) => {
  const { type } = req.body;
  const comment = await Comment.findById(req.params.commentId);

  if (!comment) {
    return sendError(res, 'Comment not found', 404);
  }

  // Remove existing reaction from user
  comment.reactions = comment.reactions.filter(
    r => r.userId.toString() !== req.user._id.toString()
  );

  // Add new reaction
  if (type) {
    comment.reactions.push({
      userId: req.user._id,
      type
    });
  }

  await comment.save();
  sendSuccess(res, 'Reaction updated', 200, comment);
}));

module.exports = router;








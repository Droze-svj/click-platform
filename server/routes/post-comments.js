// Post Comments Routes
// Commenting system for posts

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  addComment,
  getPostComments,
  resolveComment,
  addReaction,
  editComment,
  deleteComment
} = require('../services/postCommentService');
const PostComment = require('../models/PostComment');
const router = express.Router();

/**
 * POST /api/posts/:postId/comments
 * Add comment to post
 */
router.post('/:postId/comments', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const comment = await addComment(postId, req.user._id, req.body);
  sendSuccess(res, 'Comment added', 201, comment);
}));

/**
 * GET /api/posts/:postId/comments
 * Get comments for post
 */
router.get('/:postId/comments', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const {
    includeInternal = 'false',
    includeResolved = 'true',
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const comments = await getPostComments(postId, {
    includeInternal: includeInternal === 'true',
    includeResolved: includeResolved === 'true',
    sortBy,
    sortOrder
  });

  sendSuccess(res, 'Comments retrieved', 200, comments);
}));

/**
 * PUT /api/posts/:postId/comments/:commentId/resolve
 * Resolve comment
 */
router.put('/:postId/comments/:commentId/resolve', auth, asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const comment = await resolveComment(commentId, req.user._id);
  sendSuccess(res, 'Comment resolved', 200, comment);
}));

/**
 * POST /api/posts/:postId/comments/:commentId/reactions
 * Add reaction to comment
 */
router.post('/:postId/comments/:commentId/reactions', auth, asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { type } = req.body;

  if (!type) {
    return sendError(res, 'Reaction type is required', 400);
  }

  const comment = await addReaction(commentId, req.user._id, type);
  sendSuccess(res, 'Reaction added', 200, comment);
}));

/**
 * PUT /api/posts/:postId/comments/:commentId
 * Edit comment
 */
router.put('/:postId/comments/:commentId', auth, asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { text } = req.body;

  if (!text) {
    return sendError(res, 'Comment text is required', 400);
  }

  const comment = await editComment(commentId, req.user._id, text);
  sendSuccess(res, 'Comment updated', 200, comment);
}));

/**
 * DELETE /api/posts/:postId/comments/:commentId
 * Delete comment
 */
router.delete('/:postId/comments/:commentId', auth, asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  await deleteComment(commentId, req.user._id);
  sendSuccess(res, 'Comment deleted', 200);
}));

module.exports = router;



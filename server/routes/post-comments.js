// Post Comments Routes
// Commenting system for posts

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { verifyWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  addComment,
  getPostComments,
  resolveComment,
  addReaction,
  editComment,
  deleteComment
} = require('../services/postCommentService');
const PostComment = require('../models/PostComment');
const ScheduledPost = require('../models/ScheduledPost');
const router = express.Router();

// Comments inherit the parent post's access. These routes previously did NO
// ownership check, so any authed user could read another tenant's comments
// (with commenter name/email) or write onto any post by guessing its id.
async function postAccessibleBy(post, req) {
  if (!post) return false;
  const uid = String(req.user._id || req.user.id || '');
  if (String(post.userId) === uid) return true;
  for (const ws of [post.workspaceId, post.agencyWorkspaceId]) {
    if (ws) {
      try { if ((await verifyWorkspaceAccess(req.user._id, ws)).allowed) return true; } catch (_) { /* fail closed */ }
    }
  }
  return false;
}
async function accessiblePost(req, postId) {
  const post = await ScheduledPost.findById(postId)
    .select('userId workspaceId agencyWorkspaceId').lean().catch(() => null);
  return (post && await postAccessibleBy(post, req)) ? post : null;
}
// For commentId routes: the caller must have access to the comment's parent post.
async function accessibleComment(req, commentId) {
  const comment = await PostComment.findById(commentId).select('postId').lean().catch(() => null);
  if (!comment) return false;
  return !!(await accessiblePost(req, comment.postId));
}

/**
 * POST /api/posts/:postId/comments
 * Add comment to post
 */
router.post('/:postId/comments', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  if (!await accessiblePost(req, postId)) return sendError(res, 'Post not found', 404);
  const comment = await addComment(postId, req.user._id, req.body);
  sendSuccess(res, 'Comment added', 201, comment);
}));

/**
 * GET /api/posts/:postId/comments
 * Get comments for post
 */
router.get('/:postId/comments', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  if (!await accessiblePost(req, postId)) return sendError(res, 'Post not found', 404);
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
  if (!await accessibleComment(req, commentId)) return sendError(res, 'Comment not found', 404);
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

  if (!await accessibleComment(req, commentId)) return sendError(res, 'Comment not found', 404);
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



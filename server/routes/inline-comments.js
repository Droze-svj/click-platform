// Inline Comments Routes
// Enhanced inline comments on posts

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { addInlineComment, getInlineComments, resolveInlineComment } = require('../services/inlineCommentService');
const router = express.Router();

/**
 * POST /api/posts/:postId/comments/inline
 * Add inline comment
 */
router.post('/:postId/comments/inline', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;
  const comment = await addInlineComment(postId, { ...req.body, userId });
  sendSuccess(res, 'Inline comment added', 201, comment);
}));

/**
 * GET /api/posts/:postId/comments/inline
 * Get inline comments
 */
router.get('/:postId/comments/inline', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const comments = await getInlineComments(postId, req.query);
  sendSuccess(res, 'Inline comments retrieved', 200, comments);
}));

/**
 * PUT /api/posts/:postId/comments/:commentId/resolve
 * Resolve inline comment
 */
router.put('/:postId/comments/:commentId/resolve', auth, asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;
  const comment = await resolveInlineComment(commentId, userId);
  sendSuccess(res, 'Comment resolved', 200, comment);
}));

module.exports = router;



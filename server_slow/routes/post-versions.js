// Post Versions Routes
// Version history and comparison

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const {
  createPostVersion,
  compareVersions
} = require('../services/multiStepWorkflowService');
const PostVersion = require('../models/PostVersion');
const ScheduledPost = require('../models/ScheduledPost');
const router = express.Router();

/**
 * POST /api/posts/:postId/versions
 * Create new version
 */
router.post('/:postId/versions', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { changeReason, content } = req.body;

  const post = await ScheduledPost.findById(postId);
  if (!post) {
    return sendError(res, 'Post not found', 404);
  }

  const version = await createPostVersion(
    postId,
    post.contentId,
    req.user._id,
    {
      changeReason,
      content: content || post.content,
      metadata: {
        platform: post.platform,
        scheduledTime: post.scheduledTime
      }
    }
  );

  // Update post with new content
  if (content) {
    post.content = { ...post.content, ...content };
    await post.save();
  }

  sendSuccess(res, 'Version created', 201, version);
}));

/**
 * GET /api/posts/:postId/versions
 * Get version history
 */
router.get('/:postId/versions', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const versions = await PostVersion.find({ postId })
    .populate('createdBy', 'name email')
    .sort({ versionNumber: -1 })
    .lean();

  sendSuccess(res, 'Versions retrieved', 200, { versions });
}));

/**
 * GET /api/posts/:postId/versions/:versionNumber
 * Get specific version
 */
router.get('/:postId/versions/:versionNumber', auth, asyncHandler(async (req, res) => {
  const { postId, versionNumber } = req.params;
  const version = await PostVersion.findOne({ postId, versionNumber: parseInt(versionNumber) })
    .populate('createdBy', 'name email')
    .populate('comments.userId', 'name email')
    .lean();

  if (!version) {
    return sendError(res, 'Version not found', 404);
  }

  sendSuccess(res, 'Version retrieved', 200, version);
}));

/**
 * GET /api/posts/:postId/versions/compare
 * Compare two versions
 */
router.get('/:postId/versions/compare', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { version1, version2 } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'Both version numbers are required', 400);
  }

  const comparison = await compareVersions(
    postId,
    parseInt(version1),
    parseInt(version2)
  );

  sendSuccess(res, 'Versions compared', 200, comparison);
}));

/**
 * POST /api/posts/:postId/versions/:versionNumber/comments
 * Add comment to version
 */
router.post('/:postId/versions/:versionNumber/comments', auth, asyncHandler(async (req, res) => {
  const { postId, versionNumber } = req.params;
  const { text, lineNumber, position } = req.body;

  if (!text) {
    return sendError(res, 'Comment text is required', 400);
  }

  const version = await PostVersion.findOne({ postId, versionNumber: parseInt(versionNumber) });
  if (!version) {
    return sendError(res, 'Version not found', 404);
  }

  version.comments.push({
    userId: req.user._id,
    text,
    lineNumber,
    position: position || {},
    createdAt: new Date()
  });

  await version.save();
  sendSuccess(res, 'Comment added to version', 200, version);
}));

module.exports = router;



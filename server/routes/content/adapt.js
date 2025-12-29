// Content Adaptation Routes

const express = require('express');
const auth = require('../../middleware/auth');
const Content = require('../../models/Content');
const { adaptContent } = require('../../services/contentAdaptationService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * POST /api/content/:contentId/adapt
 * Apply adaptation to content
 */
router.post('/:contentId/adapt', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { platform, content, hashtags } = req.body;

  const contentDoc = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!contentDoc) {
    return sendError(res, 'Content not found', 404);
  }

  // Update generated content with adaptation
  if (!contentDoc.generatedContent) {
    contentDoc.generatedContent = {};
  }
  if (!contentDoc.generatedContent.socialPosts) {
    contentDoc.generatedContent.socialPosts = [];
  }

  // Update or add platform-specific post
  const existingIndex = contentDoc.generatedContent.socialPosts.findIndex(
    p => p.platform === platform
  );

  const postData = {
    platform,
    content: content || contentDoc.transcript,
    hashtags: hashtags || []
  };

  if (existingIndex >= 0) {
    contentDoc.generatedContent.socialPosts[existingIndex] = postData;
  } else {
    contentDoc.generatedContent.socialPosts.push(postData);
  }

  await contentDoc.save();

  sendSuccess(res, 'Content adapted successfully', 200, {
    contentId,
    platform,
    adapted: true
  });
}));

module.exports = router;


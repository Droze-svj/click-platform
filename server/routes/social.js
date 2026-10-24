// Social media integration routes

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const {
  connectAccount,
  disconnectAccount,
  getConnectedAccounts,
  postToSocialMedia,
  getOptimalPostingTimes,
  refreshAccessToken
} = require('../services/socialMediaService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/social/connect:
 *   post:
 *     summary: Connect social media account
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/connect', auth, asyncHandler(async (req, res) => {
  const { platform, accessToken, refreshToken, metadata } = req.body;

  if (!platform || !accessToken) {
    return sendError(res, 'Platform and accessToken are required', 400);
  }

  const connection = await connectAccount(req.user._id, platform, accessToken, refreshToken, metadata);
  sendSuccess(res, 'Account connected successfully', 200, connection);
}));

/**
 * @swagger
 * /api/social/disconnect:
 *   post:
 *     summary: Disconnect social media account
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/disconnect', auth, asyncHandler(async (req, res) => {
  const { platform } = req.body;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  await disconnectAccount(req.user._id, platform);
  sendSuccess(res, 'Account disconnected successfully', 200);
}));

/**
 * @swagger
 * /api/social/accounts:
 *   get:
 *     summary: Get connected accounts
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.get('/accounts', auth, asyncHandler(async (req, res) => {
  const accounts = await getConnectedAccounts(req.user._id);
  sendSuccess(res, 'Connected accounts fetched', 200, accounts);
}));

/**
 * @swagger
 * /api/social/post:
 *   post:
 *     summary: Post to social media
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/post', auth, asyncHandler(async (req, res) => {
  const { platform } = req.body || {};
  let { content } = req.body || {};
  const options = { ...((req.body && req.body.options) || {}) };
  const contentId = (req.body && req.body.contentId) || options.contentId || null;

  if (!platform || (!content && !contentId)) {
    return sendError(res, 'Platform and content (or contentId) are required', 400);
  }

  // A contentId is both the source (OneClickPublish sends only the id) and the
  // doc the service writes the post result into — so it must be the caller's.
  if (contentId) {
    const Content = require('../models/Content');
    const doc = mongoose.Types.ObjectId.isValid(String(contentId))
      ? await Content.findOne({ _id: contentId, userId: String(req.user._id || req.user.id) }).lean()
      : null;
    if (!doc) return sendError(res, 'Content not found', 404);
    options.contentId = String(doc._id);
    if (!content) {
      const clip = (doc.generatedContent && Array.isArray(doc.generatedContent.shortVideos))
        ? doc.generatedContent.shortVideos.find((v) => v && v.url) : null;
      content = {
        title: doc.title || '',
        description: (doc.content && doc.content.text) || doc.description || doc.title || '',
        mediaUrl: (doc.content && doc.content.mediaUrl) || (clip && clip.url) || (doc.originalFile && doc.originalFile.url) || undefined,
        tags: (doc.content && Array.isArray(doc.content.hashtags) && doc.content.hashtags.length)
          ? doc.content.hashtags : (doc.tags || []),
      };
    }
  }

  // Pre-flight token check — mirror of /api/scheduler/schedule. Prevents
  // publish attempts against platforms the user hasn't connected, and
  // makes the dashboard's "no token" error actionable rather than opaque.
  try {
    const oauthService = require('../services/oauthService');
    const userId = req.user._id || req.user.id;
    const accounts = await oauthService.listSocialAccounts(userId, platform);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return sendError(res, `No connected ${platform} account. Connect ${platform} first.`, 400, { code: 'PLATFORM_NOT_CONNECTED', platform });
    }
    const requestedAccountId = options?.accountId;
    if (requestedAccountId && !accounts.some((a) => a.accountId === requestedAccountId || a.platformUserId === requestedAccountId)) {
      return sendError(res, `Selected ${platform} account is no longer connected.`, 400, { code: 'ACCOUNT_NOT_CONNECTED', platform, accountId: requestedAccountId });
    }
  } catch (preflightErr) {
    logger.warn('Social post pre-flight check failed; continuing', { platform, error: preflightErr.message });
  }

  const post = await postToSocialMedia(req.user._id, platform, content, options);
  // The service reports failures as { success:false, error } rather than
  // throwing; answering 200 "Posted successfully" for those told the user a
  // post went out when it did not.
  if (!post || post.success === false) {
    return sendError(res, (post && post.error) || `Posting to ${platform} failed`, 502, { platform });
  }
  sendSuccess(res, 'Posted successfully', 200, post);
}));

/**
 * @swagger
 * /api/social/optimal-times:
 *   get:
 *     summary: Get optimal posting times
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.get('/optimal-times', auth, asyncHandler(async (req, res) => {
  const { platform } = req.query;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const times = await getOptimalPostingTimes(req.user._id, platform);
  sendSuccess(res, 'Optimal posting times fetched', 200, times);
}));

/**
 * @swagger
 * /api/social/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/refresh-token', auth, asyncHandler(async (req, res) => {
  const { platform } = req.body;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  const connection = await refreshAccessToken(req.user._id, platform);
  sendSuccess(res, 'Token refreshed successfully', 200, connection);
}));

module.exports = router;

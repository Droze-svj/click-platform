// Social media integration routes

const express = require('express');
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
  const { platform, content, options } = req.body;

  if (!platform || !content) {
    return sendError(res, 'Platform and content are required', 400);
  }

  const post = await postToSocialMedia(req.user._id, platform, content, options);
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

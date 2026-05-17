// TikTok OAuth Routes

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
// Singleton instance — destructuring would drop `this` and crash.
const tiktokService = require('../../services/tiktokOAuthService');
const OAuthStorage = require('../../utils/oauthStorage');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

/**
 * GET /api/oauth/tiktok/authorize
 * Get TikTok OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!tiktokService.isConfigured()) {
    return sendError(res, 'TikTok OAuth not configured', 503);
  }

  const callbackUrl = process.env.TIKTOK_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/oauth/tiktok/callback`;

  const userId = req.userId || req.user?._id || req.user?.id;
  const { url, state } = await tiktokService.getAuthorizationUrl(userId, callbackUrl);

  sendSuccess(res, 'Authorization URL generated', 200, { url, state });
}));

/**
 * GET /api/oauth/tiktok/callback
 * Handle TikTok OAuth callback
 */
router.get('/callback', oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('TikTok OAuth callback error', { error });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return sendError(res, 'Missing authorization code or state', 400);
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?platform=tiktok&code=${code}&state=${state}`);
  } catch (err) {
    logger.error('TikTok OAuth callback error', { error: err.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(err.message)}`);
  }
}));

/**
 * POST /api/oauth/tiktok/complete
 * Complete OAuth connection (called from frontend)
 */
router.post('/complete', auth, oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return sendError(res, 'Authorization code and state are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const { accessToken } = await tiktokService.exchangeCodeForToken(userId, code, state);

  const userInfo = await tiktokService.getTikTokUserInfo(accessToken);

  sendSuccess(res, 'TikTok account connected successfully', 200, {
    connected: true,
    userInfo: {
      open_id: userInfo.open_id,
      display_name: userInfo.display_name,
      follower_count: userInfo.follower_count,
    },
  });
}));

/**
 * POST /api/oauth/tiktok/upload
 * Upload video to TikTok
 */
router.post('/upload', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { videoFile, caption, options } = req.body;

  if (!videoFile || !caption) {
    return sendError(res, 'Video file and caption are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const video = await tiktokService.uploadVideoToTikTok(userId, videoFile, caption, options || {});

  sendSuccess(res, 'TikTok video uploaded successfully', 200, { video });
}));

/**
 * POST /api/oauth/tiktok/post
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { videoUrl, caption, options } = req.body;

  if (!videoUrl || !caption) {
    return sendError(res, 'Video URL and caption are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const post = await tiktokService.postToTikTok(userId, videoUrl, caption, options || {});

  sendSuccess(res, 'TikTok post published successfully', 200, { post });
}));

/**
 * DELETE /api/oauth/tiktok/disconnect
 * Disconnect TikTok account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  await tiktokService.disconnectTikTok(userId);
  sendSuccess(res, 'TikTok account disconnected', 200);
}));

/**
 * GET /api/oauth/tiktok/status
 * Get TikTok connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  let ttRow = null;

  if (isMongoUserId(userId)) {
    const User = require('../../models/User');
    const user = await User.findById(userId).select('oauth.tiktok');
    ttRow = user?.oauth?.tiktok || null;
  } else {
    ttRow = await OAuthStorage.loadTokens(userId, 'tiktok');
  }

  sendSuccess(res, 'Status retrieved', 200, {
    connected: !!ttRow?.connected,
    connectedAt: ttRow?.connectedAt,
    username: ttRow?.platformUsername,
    configured: tiktokService.isConfigured()
  });
}));

module.exports = router;

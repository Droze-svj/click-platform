// TikTok OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getAuthorizationUrl,
  exchangeCodeForToken,
  uploadVideoToTikTok,
  postToTikTok,
  disconnectTikTok,
  isConfigured
} = require('../../services/tiktokOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/oauth/tiktok/authorize
 * Get TikTok OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    return sendError(res, 'TikTok OAuth not configured', 503);
  }

  const callbackUrl = process.env.TIKTOK_CALLBACK_URL || 
    `${req.protocol}://${req.get('host')}/api/oauth/tiktok/callback`;

  const { url, state } = await getAuthorizationUrl(req.user._id, callbackUrl);
  
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
    // Redirect to frontend with code/state
    // Frontend will call /complete endpoint
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?platform=tiktok&code=${code}&state=${state}`);
  } catch (error) {
    logger.error('TikTok OAuth callback error', { error: error.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error.message)}`);
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

  const { accessToken } = await exchangeCodeForToken(req.user._id, code, state);
  
  // Get user info for response
  const { getTikTokUserInfo } = require('../../services/tiktokOAuthService');
  const userInfo = await getTikTokUserInfo(accessToken);
  
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

  const video = await uploadVideoToTikTok(req.user._id, videoFile, caption, options || {});
  
  sendSuccess(res, 'TikTok video uploaded successfully', 200, { video });
}));

/**
 * POST /api/oauth/tiktok/post
 * Post to TikTok (placeholder for future implementation)
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { videoUrl, caption, options } = req.body;

  if (!videoUrl || !caption) {
    return sendError(res, 'Video URL and caption are required', 400);
  }

  const post = await postToTikTok(req.user._id, videoUrl, caption, options || {});
  
  sendSuccess(res, 'TikTok post published successfully', 200, { post });
}));

/**
 * DELETE /api/oauth/tiktok/disconnect
 * Disconnect TikTok account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  await disconnectTikTok(req.user._id);
  sendSuccess(res, 'TikTok account disconnected', 200);
}));

/**
 * GET /api/oauth/tiktok/status
 * Get TikTok connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const User = require('../../models/User');
  const user = await User.findById(req.user._id).select('oauth.tiktok');
  
  const connected = user?.oauth?.tiktok?.connected || false;
  const connectedAt = user?.oauth?.tiktok?.connectedAt;
  const username = user?.oauth?.tiktok?.platformUsername;

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    connectedAt,
    username,
    configured: isConfigured()
  });
}));

module.exports = router;



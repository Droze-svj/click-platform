// LinkedIn OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getAuthorizationUrl,
  exchangeCodeForToken,
  postToLinkedIn,
  disconnectLinkedIn,
  isConfigured
} = require('../../services/linkedinOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/oauth/linkedin/authorize
 * Get LinkedIn OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    return sendError(res, 'LinkedIn OAuth not configured', 503);
  }

  const callbackUrl = process.env.LINKEDIN_CALLBACK_URL || 
    `${req.protocol}://${req.get('host')}/api/oauth/linkedin/callback`;

  const { url, state } = await getAuthorizationUrl(req.user._id, callbackUrl);
  
  sendSuccess(res, 'Authorization URL generated', 200, { url, state });
}));

/**
 * GET /api/oauth/linkedin/callback
 * Handle LinkedIn OAuth callback
 */
router.get('/callback', oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('LinkedIn OAuth callback error', { error });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return sendError(res, 'Missing authorization code or state', 400);
  }

  try {
    // Note: In production, you'd get userId from session/cookie
    // For now, we'll redirect to frontend with code/state
    // Frontend will call /complete endpoint
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?platform=linkedin&code=${code}&state=${state}`);
  } catch (error) {
    logger.error('LinkedIn OAuth callback error', { error: error.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * POST /api/oauth/linkedin/complete
 * Complete OAuth connection (called from frontend)
 */
router.post('/complete', auth, oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return sendError(res, 'Authorization code and state are required', 400);
  }

  const { accessToken } = await exchangeCodeForToken(req.user._id, code, state);
  
  // Get user info for response
  const { getLinkedInUserInfo } = require('../../services/linkedinOAuthService');
  const userInfo = await getLinkedInUserInfo(accessToken);
  
  sendSuccess(res, 'LinkedIn account connected successfully', 200, {
    connected: true,
    userInfo: {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
    },
  });
}));

/**
 * POST /api/oauth/linkedin/post
 * Post to LinkedIn
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { text, mediaUrl, title } = req.body;

  if (!text || text.trim().length === 0) {
    return sendError(res, 'Post text is required', 400);
  }

  const options = {};
  if (mediaUrl) options.mediaUrl = mediaUrl;
  if (title) options.title = title;

  const post = await postToLinkedIn(req.user._id, text, options);
  
  sendSuccess(res, 'LinkedIn post published successfully', 200, { post });
}));

/**
 * DELETE /api/oauth/linkedin/disconnect
 * Disconnect LinkedIn account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  await disconnectLinkedIn(req.user._id);
  sendSuccess(res, 'LinkedIn account disconnected', 200);
}));

/**
 * GET /api/oauth/linkedin/status
 * Get LinkedIn connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const User = require('../../models/User');
  const user = await User.findById(req.user._id).select('oauth.linkedin');
  
  const connected = user?.oauth?.linkedin?.connected || false;
  const connectedAt = user?.oauth?.linkedin?.connectedAt;

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    connectedAt,
    configured: isConfigured()
  });
}));

module.exports = router;




// Facebook OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getAuthorizationUrl,
  exchangeCodeForToken,
  getFacebookPages,
  postToFacebook,
  disconnectFacebook,
  isConfigured
} = require('../../services/facebookOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/oauth/facebook/authorize
 * Get Facebook OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    return sendError(res, 'Facebook OAuth not configured', 503);
  }

  const callbackUrl = process.env.FACEBOOK_CALLBACK_URL || 
    `${req.protocol}://${req.get('host')}/api/oauth/facebook/callback`;

  const { url, state } = await getAuthorizationUrl(req.user._id, callbackUrl);
  
  sendSuccess(res, 'Authorization URL generated', 200, { url, state });
}));

/**
 * GET /api/oauth/facebook/callback
 * Handle Facebook OAuth callback
 */
router.get('/callback', oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('Facebook OAuth callback error', { error });
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
    res.redirect(`${frontendUrl}/dashboard/social?platform=facebook&code=${code}&state=${state}`);
  } catch (error) {
    logger.error('Facebook OAuth callback error', { error: error.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * POST /api/oauth/facebook/complete
 * Complete OAuth connection (called from frontend)
 */
router.post('/complete', auth, oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return sendError(res, 'Authorization code and state are required', 400);
  }

  const { accessToken } = await exchangeCodeForToken(req.user._id, code, state);
  
  // Get user info and pages for response
  const { getFacebookUserInfo, getFacebookPages } = require('../../services/facebookOAuthService');
  const userInfo = await getFacebookUserInfo(accessToken);
  const pages = await getFacebookPages(accessToken);
  
  sendSuccess(res, 'Facebook account connected successfully', 200, {
    connected: true,
    userInfo: {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
    },
    pages: pages.map(page => ({
      id: page.id,
      name: page.name,
    })),
  });
}));

/**
 * GET /api/oauth/facebook/pages
 * Get user's Facebook pages
 */
router.get('/pages', auth, asyncHandler(async (req, res) => {
  const User = require('../../models/User');
  const user = await User.findById(req.user._id).select('oauth.facebook');
  
  if (!user || !user.oauth?.facebook?.connected) {
    return sendError(res, 'Facebook account not connected', 400);
  }

  const pages = user.oauth.facebook.pages || [];
  sendSuccess(res, 'Pages retrieved', 200, { pages });
}));

/**
 * POST /api/oauth/facebook/post
 * Post to Facebook
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { text, pageId, link, imageUrl } = req.body;

  if (!text || text.trim().length === 0) {
    return sendError(res, 'Post text is required', 400);
  }

  const options = {};
  if (pageId) options.pageId = pageId;
  if (link) options.link = link;
  if (imageUrl) options.imageUrl = imageUrl;

  const post = await postToFacebook(req.user._id, text, options);
  
  sendSuccess(res, 'Facebook post published successfully', 200, { post });
}));

/**
 * DELETE /api/oauth/facebook/disconnect
 * Disconnect Facebook account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  await disconnectFacebook(req.user._id);
  sendSuccess(res, 'Facebook account disconnected', 200);
}));

/**
 * GET /api/oauth/facebook/status
 * Get Facebook connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const User = require('../../models/User');
  const user = await User.findById(req.user._id).select('oauth.facebook');
  
  const connected = user?.oauth?.facebook?.connected || false;
  const connectedAt = user?.oauth?.facebook?.connectedAt;
  const pages = user?.oauth?.facebook?.pages || [];

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    connectedAt,
    pagesCount: pages.length,
    configured: isConfigured()
  });
}));

module.exports = router;




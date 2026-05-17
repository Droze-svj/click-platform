// LinkedIn OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
// Singleton instance — destructuring would drop `this` and crash.
const linkedinService = require('../../services/linkedinOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/oauth/linkedin/health
 * Health check for LinkedIn OAuth config
 */
router.get('/health', asyncHandler(async (req, res) => {
  const h = typeof linkedinService.healthCheck === 'function'
    ? linkedinService.healthCheck()
    : { configured: linkedinService.isConfigured() };
  sendSuccess(res, 'Health check', 200, h);
}));

/**
 * GET /api/oauth/linkedin/authorize
 * Get LinkedIn OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!linkedinService.isConfigured()) {
    return sendError(res, 'LinkedIn OAuth not configured', 503);
  }

  const callbackUrl = typeof linkedinService.defaultRedirectUri === 'function'
    ? linkedinService.defaultRedirectUri(req)
    : (process.env.LINKEDIN_CALLBACK_URL ||
       `${req.protocol}://${req.get('host')}/api/oauth/linkedin/callback`);

  const userId = req.userId || req.user?._id || req.user?.id;
  const { url, state } = await linkedinService.getAuthorizationUrl(userId, callbackUrl);

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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?platform=linkedin&code=${code}&state=${state}`);
  } catch (err) {
    logger.error('LinkedIn OAuth callback error', { error: err.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(err.message)}`);
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

  const userId = req.userId || req.user?._id || req.user?.id;
  const { accessToken } = await linkedinService.exchangeCodeForToken(userId, code, state);

  const userInfo = await linkedinService.getLinkedInUserInfo(accessToken);

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
 * Post to LinkedIn. Body: text (required), mediaUrl, title, imageUrl, visibility (PUBLIC|CONNECTIONS), fallbackToTextOnImageError (bool).
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { text, mediaUrl, title, imageUrl, visibility, fallbackToTextOnImageError } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return sendError(res, 'Post text is required', 400);
  }

  const options = {};
  if (mediaUrl) options.mediaUrl = mediaUrl;
  if (title) options.title = title;
  if (imageUrl) options.imageUrl = imageUrl;
  if (visibility === 'CONNECTIONS' || visibility === 'PUBLIC') options.visibility = visibility;
  if (fallbackToTextOnImageError === true || fallbackToTextOnImageError === 'true') options.fallbackToTextOnImageError = true;

  const userId = req.userId || req.user?._id || req.user?.id;
  const post = await linkedinService.postToLinkedIn(userId, text, options);

  sendSuccess(res, 'LinkedIn post published successfully', 200, { post });
}));

/**
 * DELETE /api/oauth/linkedin/disconnect
 * Disconnect LinkedIn account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  await linkedinService.disconnectLinkedIn(userId);
  sendSuccess(res, 'LinkedIn account disconnected', 200);
}));

/**
 * GET /api/oauth/linkedin/status
 * Get LinkedIn connection status (from Supabase social_links)
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  const status = await linkedinService.getConnectionStatus(userId);
  sendSuccess(res, 'Status retrieved', 200, status);
}));

module.exports = router;

// Google OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getAuthorizationUrl,
  exchangeCodeForToken,
  disconnectGoogle,
  isConfigured
} = require('../../services/googleOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/oauth/google/authorize
 * Get Google OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    return sendError(res, 'Google OAuth not configured', 503);
  }

  const callbackUrl = process.env.GOOGLE_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/oauth/google/callback`;

  const { url, state } = await getAuthorizationUrl(req.user._id, callbackUrl);

  sendSuccess(res, 'Authorization URL generated', 200, { url, state });
}));

/**
 * GET /api/oauth/google/callback
 * Handle Google OAuth callback
 */
router.get('/callback', oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('Google OAuth callback error', { error });
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
    res.redirect(`${frontendUrl}/dashboard/social?platform=google&code=${code}&state=${state}`);
  } catch (error) {
    logger.error('Google OAuth callback error', { error: error.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * POST /api/oauth/google/complete
 * Complete OAuth connection (called from frontend)
 */
router.post('/complete', auth, oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return sendError(res, 'Authorization code and state are required', 400);
  }

  const { accessToken, userInfo } = await exchangeCodeForToken(req.user._id, code, state);

  // Get user info for response
  sendSuccess(res, 'Google account connected successfully', 200, {
    connected: true,
    userInfo: {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
    },
  });
}));

/**
 * DELETE /api/oauth/google/disconnect
 * Disconnect Google account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  await disconnectGoogle(req.user._id);
  sendSuccess(res, 'Google account disconnected', 200);
}));

/**
 * GET /api/oauth/google/status
 * Get Google connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const { data: user, error } = await require('@supabase/supabase-js').createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    .from('users')
    .select('social_links')
    .eq('id', req.user._id)
    .single();

  if (error) {
    return sendError(res, 'Database error', 500);
  }

  const oauthData = user?.social_links?.oauth || {};
  const googleData = oauthData.google || {};
  const connected = googleData.connected || false;
  const connectedAt = googleData.connectedAt;

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    connectedAt,
    configured: isConfigured()
  });
}));

module.exports = router;

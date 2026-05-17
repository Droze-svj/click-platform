// Google OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
// Singleton instance — destructuring would drop `this` and crash.
const googleService = require('../../services/googleOAuthService');
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
  if (!googleService.isConfigured()) {
    return sendError(res, 'Google OAuth not configured', 503);
  }

  const callbackUrl = process.env.GOOGLE_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/oauth/google/callback`;

  const userId = req.userId || req.user?._id || req.user?.id;
  const { url, state } = await googleService.getAuthorizationUrl(userId, callbackUrl);

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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?platform=google&code=${code}&state=${state}`);
  } catch (err) {
    logger.error('Google OAuth callback error', { error: err.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(err.message)}`);
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

  const userId = req.userId || req.user?._id || req.user?.id;
  const { userInfo } = await googleService.exchangeCodeForToken(userId, code, state);

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
  const userId = req.userId || req.user?._id || req.user?.id;
  await googleService.disconnectGoogle(userId);
  sendSuccess(res, 'Google account disconnected', 200);
}));

/**
 * GET /api/oauth/google/status
 * Get Google connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Database not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const userId = req.userId || req.user?._id || req.user?.id;
    const { data: user, error } = await supabase
      .from('users')
      .select('social_links')
      .eq('id', userId)
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
      configured: googleService.isConfigured()
    });
  } catch (dbError) {
    logger.error('Google OAuth status error', { error: dbError.message });
    return sendError(res, 'Database error', 500);
  }
}));

module.exports = router;

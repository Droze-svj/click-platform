// Google OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
// Singleton instance — destructuring would drop `this` and crash.
const googleService = require('../../services/googleOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const { resolveOAuthCallbackUrl } = require('../../utils/oauthCallbackUrl');
const OAuthStorage = require('../../utils/oauthStorage');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter } = require('../../middleware/oauthRateLimiter');
const ssx = require('../../utils/oauthServerSideExchange');
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

  // Resolved through the shared helper so the callback route's exchange can
  // derive the identical value — OAuth rejects the exchange otherwise.
  const callbackUrl = resolveOAuthCallbackUrl('google', req);

  const userId = req.userId || req.user?._id || req.user?.id;
  const { url, state } = await googleService.getAuthorizationUrl(userId, callbackUrl);
  // When server-side exchange is enabled, sign the userId into the state so the
  // session-less callback can exchange the code itself (no code in the URL).
  const finalUrl = ssx.serverSideExchangeEnabled() ? ssx.wrapAuthorizeUrl(url, userId, 'google') : url;

  sendSuccess(res, 'Authorization URL generated', 200, { url: finalUrl, state });
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

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    // Hardened path: exchange server-side so the single-use code never reaches
    // the browser URL. Legacy path (flag off) hands the code to /complete.
    if (ssx.serverSideExchangeEnabled()) {
      const u = ssx.unwrapCallbackState(state);
      if (!u) return res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent('Invalid OAuth state')}`);
      await googleService.exchangeCodeForToken(u.userId, code, u.innerState, resolveOAuthCallbackUrl('google', req));
      return res.redirect(`${frontendUrl}/dashboard/social?connected=google&success=true`);
    }
    res.redirect(`${frontendUrl}/dashboard/social?platform=google&code=${code}&state=${state}`);
  } catch (err) {
    logger.error('Google OAuth callback error', { error: err.message });
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
  const { userInfo } = await googleService.exchangeCodeForToken(userId, code, state, resolveOAuthCallbackUrl('google', req));

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
  // Read through OAuthStorage, exactly like every other provider's /status.
  //
  // This route used to build its OWN Supabase client and 503 with "Database not
  // configured" when SUPABASE_URL was unset. Supabase auth is off by default
  // here (the boot log says "Using Mongoose fallback"), so Google was the only
  // provider whose status endpoint failed on a stock install — the other six
  // returned 200 in the same environment.
  const userId = req.userId || req.user?._id || req.user?.id;
  const row = await OAuthStorage.loadTokens(userId, 'google');
  const accounts = Array.isArray(row?.accounts) ? row.accounts : [];
  const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;

  sendSuccess(res, 'Status retrieved', 200, {
    connected: accounts.length > 0 || !!row?.connected,
    connectedAt: primary?.addedAt || row?.connectedAt || null,
    username: primary?.platformUsername || row?.platformUsername || null,
    accounts: accounts.length,
    configured: googleService.isConfigured(),
  });
}));

module.exports = router;

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { apiLimiter, oauthLimiter } = require('../middleware/enhancedRateLimiter');
const router = express.Router();

// OAuth Services
const twitterOAuth = require('../services/twitterOAuthService');
const tiktokOAuth = require('../services/tiktokOAuthService');
const youtubeOAuth = require('../services/youtubeOAuthService');
const instagramOAuth = require('../services/instagramOAuthService');
const linkedinOAuth = require('../services/linkedinOAuthService');
const facebookOAuth = require('../services/facebookOAuthService');
const googleOAuth = require('../services/googleOAuthService');
const { validateConnect, validateCallback, validateDisconnect } = require('../validators/oauthValidator');

/**
 * Maps platform strings to their respective service modules.
 */
function getServiceByPlatform(platform) {
  if (!platform) return null;
  switch (platform.toLowerCase()) {
  case 'twitter': return twitterOAuth;
  case 'tiktok': return tiktokOAuth;
  case 'youtube': return youtubeOAuth;
  case 'instagram': return instagramOAuth;
  case 'linkedin': return linkedinOAuth;
  case 'facebook': return facebookOAuth;
  case 'google': return googleOAuth;
  default: return null;
  }
}

/**
 * @swagger
 * /api/oauth/{platform}/connect:
 *   get:
 *     summary: Initiate OAuth connection flow
 *     description: Generates a signed authorization URL for the specified social platform. Includes state-encoded data for userId and redirect preservation.
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [twitter, tiktok, youtube, instagram, linkedin, facebook]
 *       - in: query
 *         name: redirect_uri
 *         schema:
 *           type: string
 *         description: Optional custom URI to redirect back to after successful connection.
 *     responses:
 *       200:
 *         description: Signed authorization URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 auth_url: { type: 'string' }
 *                 state: { type: 'string' }
 */
router.get('/:platform/connect', auth, oauthLimiter, validateConnect, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const plat = platform.toLowerCase();
  const service = getServiceByPlatform(plat);

  if (!service) {
    return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
  }
  if (!service.isConfigured()) {
    return res.status(400).json({ success: false, error: `${platform} OAuth not configured.` });
  }

  const { redirect_uri } = req.query;
  const baseRedirect = redirect_uri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social`;

  const userId = req.user._id || req.user.id;
  
  // Create state payload
  const statePayload = {
    userId,
    platform: plat,
    redirectUri: baseRedirect
  };

  // Handle PKCE for Twitter (special case)
  if (plat === 'twitter') {
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    statePayload.codeVerifier = codeVerifier;
  }

  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');
  
  try {
    const callbackUrl = service.defaultRedirectUri?.(req) || 
      `${process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001'}/api/oauth/${plat}/callback`;
    
    // Pass the signed state and callback URL to the service
    const result = await service.getAuthorizationUrl(userId, state, callbackUrl);
    
    // Some services return {url, state}, others just url string
    const authUrl = typeof result === 'object' ? result.url : result;

    res.json({ success: true, auth_url: authUrl, state });
  } catch (error) {
    logger.error('OAuth connect error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to initiate OAuth connection' });
  }
}));

/**
 * @swagger
 * /api/oauth/{platform}/callback:
 *   get:
 *     summary: Handle OAuth callback
 *     description: Receives the authorization code from the platform provider, validates state, and exchanges it for access/refresh tokens.
 *     tags: [OAuth]
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema: { type: 'string' }
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: 'string' }
 *       - in: query
 *         name: state
 *         required: true
 *         schema: { type: 'string' }
 *     responses:
 *       302:
 *         description: Redirects back to the dashboard with success/error status.
 */
router.get('/:platform/callback', validateCallback, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const plat = platform.toLowerCase();
  const service = getServiceByPlatform(plat);

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !state || !service) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=missing_params`);
  }

  // Decode the base64 `state` defensively — a malformed/forged value must
  // redirect with a clear invalid_state error, not fall through to the
  // generic token-exchange catch (which would mislabel it as a provider error).
  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString());
  } catch (e) {
    logger.warn(`OAuth callback received malformed state for ${platform}`);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=invalid_state`);
  }
  if (!stateData || typeof stateData !== 'object' || !stateData.userId) {
    logger.warn(`OAuth callback state missing userId for ${platform}`);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=invalid_state`);
  }

  try {
    const { userId, redirectUri: originalRedirectUri, codeVerifier } = stateData;

    // Standardize token exchange
    // Newer services handle connection internally in exchangeCodeForToken, 
    // older ones use the tokens -> profile -> connect flow.
    if (service.exchangeCodeForToken.length >= 3) {
      // Platform supports (userId, code, state) pattern (Instagram, LinkedIn, Facebook)
      await service.exchangeCodeForToken(userId, code, stateData.state || state);
    } else {
      // Platform supports (code, codeVerifier) pattern (Twitter, YouTube, TikTok)
      const tokens = await service.exchangeCodeForToken(code, codeVerifier);
      const profile = await service.getUserProfile(tokens.access_token || tokens.accessToken);
      await service.connectAccount(userId, tokens, profile);
    }

    logger.info(`OAuth connection successful for ${platform}`, { userId });

    const successRedirectUri = `${originalRedirectUri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social`}?success=true&platform=${platform}`;
    res.redirect(successRedirectUri);

  } catch (error) {
    // Extract useful fields rather than dumping the whole error object —
    // AxiosError has circular references (request <-> response) that
    // previously crashed the winston printf format and turned a
    // diagnosable failure into an opaque 500 with no log info.
    const status = error?.response?.status || error?.statusCode || null;
    const providerError =
      error?.response?.data?.error_description
      || error?.response?.data?.error
      || (typeof error?.response?.data === 'string' ? error.response.data : null)
      || error?.message
      || 'unknown';
    logger.error(`OAuth callback error for ${platform}`, {
      platform,
      status,
      provider: providerError,
      // Useful for triage but bounded — full stack would balloon the log.
      stack: error?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    const reason = encodeURIComponent(typeof providerError === 'string' ? providerError.slice(0, 200) : 'oauth_failed');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=${reason}&platform=${platform}`);
  }
}));

/**
 * GET /api/oauth/connections
 * Get user's active connections
 */
router.get('/connections', auth, apiLimiter, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId || req.user.id || req.user._id;
    const platforms = ['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook', 'google'];

    // No dev-user short-circuit here. Dev users can OAuth real platforms
    // against their stable ObjectId; the per-platform `/status` route already
    // reads real storage, so the unified `/connections` view must do the same
    // or the dashboard reports stale "0 connected" while the platform card
    // shows "connected". Storage returns [] for unconnected platforms anyway.

    // accounts: { <platform>: PlatformAccount[] }
    const accounts = {};
    await Promise.all(platforms.map(async (p) => {
      accounts[p] = [];
      const service = getServiceByPlatform(p);
      if (!service || typeof service.getConnectedAccounts !== 'function') return;
      try {
        const accs = await service.getConnectedAccounts(userId);
        accounts[p] = Array.isArray(accs) ? accs : (accs ? [accs] : []);
      } catch (e) {
        logger.warn(`Error fetching ${p} accounts:`, { userId, error: e?.message });
      }
    }));

    res.json({ success: true, accounts });
  } catch (error) {
    logger.error('OAuth connections error', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch connected accounts' });
  }
}));

/**
 * GET /api/oauth/accounts
 * Standardized endpoint for fetching connected social accounts.
 * Supports development mode mock accounts.
 */
router.get('/accounts', auth, apiLimiter, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId || req.user.id || req.user._id;
    const platforms = ['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook', 'google'];

    // Read real storage even for dev users — see /connections for rationale.

    const accounts = {};
    await Promise.all(platforms.map(async (p) => {
      accounts[p] = [];
      const service = getServiceByPlatform(p);
      if (!service || typeof service.getConnectedAccounts !== 'function') return;
      try {
        const accs = await service.getConnectedAccounts(userId);
        accounts[p] = Array.isArray(accs) ? accs : (accs ? [accs] : []);
      } catch (e) {
        logger.warn(`Failed to fetch ${p} accounts for user ${userId}`, { error: e.message });
      }
    }));

    res.json({ success: true, accounts });
  } catch (error) {
    logger.error('Critical failure in /oauth/accounts', { error: error.message });
    res.status(500).json({ success: false, error: 'Topology scan failed' });
  }
}));

/**
 * DELETE /api/oauth/:platform/disconnect
 *
 * Multi-account aware. Body params (all optional):
 *   - platform_user_id (legacy) — platform-side user id of the account to drop
 *   - accountId — same thing, named for consistency with the new storage
 * Without either, every account on that platform is disconnected.
 *
 * Response shape: { success, remaining: <count of accounts still connected> }
 */
router.delete('/:platform/disconnect', auth, apiLimiter, validateDisconnect, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const plat = platform.toLowerCase();
  const userId = req.userId || req.user.id || req.user._id;
  const accountId = req.body?.accountId || req.body?.platform_user_id || null;

  const service = getServiceByPlatform(plat);
  if (!service) {
    return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
  }

  try {
    let result;
    // Prefer the generic name, fall back to the per-platform name. Pass
    // accountId through so single-account drops work.
    if (typeof service.disconnectAccount === 'function') {
      result = await service.disconnectAccount(userId, accountId);
    } else {
      const fnName = `disconnect${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
      if (typeof service[fnName] === 'function') {
        result = await service[fnName](userId, accountId);
      } else {
        throw new Error('Disconnect method not found on service');
      }
    }

    logger.info('Account disconnected', { platform: plat, userId, accountId, remaining: result?.remaining });
    res.json({
      success: true,
      message: `${platform} disconnected successfully`,
      remaining: typeof result?.remaining === 'number' ? result.remaining : null,
    });
  } catch (error) {
    logger.error('OAuth disconnect error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to disconnect account' });
  }
}));

/**
 * POST /api/oauth/:platform/active
 * Switch which connected account is active for one-account UI surfaces.
 * Body: { accountId } (required).
 */
router.post('/:platform/active', auth, apiLimiter, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const userId = req.userId || req.user.id || req.user._id;
  const { accountId } = req.body || {};
  if (!accountId) return res.status(400).json({ success: false, error: 'accountId is required' });

  const oauthService = require('../services/oauthService');
  try {
    const ok = await oauthService.setActiveSocialAccount(userId, platform.toLowerCase(), accountId);
    if (!ok) return res.status(404).json({ success: false, error: 'Account not found for this user/platform' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Set active account error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to switch active account' });
  }
}));

/**
 * GET /api/oauth/:platform/accounts
 * List every connected account for the user on this platform.
 * Used by the new social dashboard to render the per-platform list.
 */
router.get('/:platform/accounts', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const userId = req.userId || req.user.id || req.user._id;
  const oauthService = require('../services/oauthService');
  try {
    const accounts = await oauthService.listSocialAccounts(userId, platform.toLowerCase());
    res.json({ success: true, accounts });
  } catch (error) {
    logger.error('List accounts error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to list accounts' });
  }
}));

/**
 * GET /api/oauth/:platform/status
 */
router.get('/:platform/status', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const service = getServiceByPlatform(platform);
  
  if (!service) {
    return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
  }

  const userId = req.userId || req.user.id || req.user._id;
  const rawAccounts = service.getConnectedAccounts ? await service.getConnectedAccounts(userId) : [];
  // Normalise to an array — some legacy callers returned a single object
  // or null. The `accounts` field is always an array so the client can
  // iterate without type guards.
  const accounts = Array.isArray(rawAccounts) ? rawAccounts : (rawAccounts ? [rawAccounts] : []);

  res.json({
    success: true,
    platform,
    configured: service.isConfigured(),
    // `connected` reflects "at least one account linked", not
    // "endpoint returned a value" — `!!accounts` used to be true even
    // for an empty array, which made the dashboard show platforms as
    // connected when nothing was actually linked.
    connected: accounts.length > 0,
    accounts,
  });
}));

/**
 * POST /api/oauth/:platform/refresh
 * Manually refresh a social media access token
 */
router.post('/:platform/refresh', auth, oauthLimiter, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const plat = platform.toLowerCase();
  const service = getServiceByPlatform(plat);

  if (!service || !service.refreshAccessToken) {
    return res.status(400).json({ 
      success: false, 
      error: `Platform ${platform} does not support background token rotation.` 
    });
  }

  const userId = req.user.id || req.user._id;
  
  try {
    const newToken = await service.refreshAccessToken(userId);
    res.json({ 
      success: true, 
      message: `${platform} token refreshed successfully`,
      hasNewToken: !!newToken
    });
  } catch (error) {
    logger.error('Manual OAuth refresh error', { error: error.message, platform });
    res.status(500).json({ success: false, error: error.message || 'Failed to refresh token' });
  }
}));

/**
 * GET /api/oauth/status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    configured: {
      twitter: twitterOAuth.isConfigured(),
      tiktok: tiktokOAuth.isConfigured(),
      youtube: youtubeOAuth.isConfigured(),
      instagram: instagramOAuth.isConfigured(),
      linkedin: linkedinOAuth.isConfigured?.() ?? false,
      facebook: facebookOAuth.isConfigured?.() ?? false
    }
  });
});

module.exports = router;

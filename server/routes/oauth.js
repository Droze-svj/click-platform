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
const { isDevUser } = require('../utils/devUser');
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

  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
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
    logger.error(`OAuth callback error for ${platform}:`, error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=oauth_failed`);
  }
}));

/**
 * GET /api/oauth/connections
 * Get user's active connections
 */
router.get('/connections', auth, apiLimiter, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    if (isDevUser(req.user)) {
      const platforms = ['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'];
      const accounts = Object.fromEntries(platforms.map((p) => [p, null]));
      return res.json({ success: true, accounts });
    }

    const platforms = ['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'];
    const accounts = {};

    for (const p of platforms) {
      accounts[p] = null;
      const service = getServiceByPlatform(p);
      if (service && service.getConnectedAccounts) {
        try {
          const accs = await service.getConnectedAccounts(userId);
          if (accs && accs.length > 0) {
            accounts[p] = p === 'twitter' ? accs : accs[0];
          }
        } catch (e) { 
          logger.warn(`Error fetching ${p} accounts:`, { userId, error: e?.message }); 
        }
      }
    }

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
    const userId = req.user.id || req.user._id;

    // Handle Development/Dev-User bypass
    if (isDevUser(req.user)) {
      const platforms = ['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'];
      const accounts = Object.fromEntries(platforms.map((p) => [p, null]));
      return res.json({ success: true, accounts });
    }

    const platforms = ['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'];
    const accounts = {};

    for (const p of platforms) {
      accounts[p] = null;
      const service = getServiceByPlatform(p);
      if (service && service.getConnectedAccounts) {
        try {
          const accs = await service.getConnectedAccounts(userId);
          if (accs && accs.length > 0) {
            // Twitter usually returns multiple, others usually return one
            accounts[p] = p === 'twitter' ? accs : accs[0];
          }
        } catch (e) {
          logger.warn(`Failed to fetch ${p} accounts for user ${userId}`, { error: e.message });
        }
      }
    }

    res.json({ success: true, accounts });
  } catch (error) {
    logger.error('Critical failure in /oauth/accounts', { error: error.message });
    res.status(500).json({ success: false, error: 'Topology scan failed' });
  }
}));

/**
 * DELETE /api/oauth/:platform/disconnect
 */
router.delete('/:platform/disconnect', auth, apiLimiter, validateDisconnect, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const plat = platform.toLowerCase();
  const userId = req.user.id || req.user._id;
  const { platform_user_id } = req.body;

  const service = getServiceByPlatform(plat);
  if (!service) {
    return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
  }

  try {
    // Standardize disconnect
    if (service.disconnectAccount) {
      await service.disconnectAccount(userId, platform_user_id);
    } else if (service[`disconnect${platform.charAt(0).toUpperCase() + platform.slice(1)}`]) {
      // Fallback for older naming
      await service[`disconnect${platform.charAt(0).toUpperCase() + platform.slice(1)}`](userId);
    } else {
      throw new Error('Disconnect method not found on service');
    }

    logger.info('Account disconnected', { platform: plat, userId, platform_user_id });
    res.json({ success: true, message: `${platform} disconnected successfully` });
  } catch (error) {
    logger.error('OAuth disconnect error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to disconnect account' });
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

  const userId = req.user.id || req.user._id;
  const accounts = service.getConnectedAccounts ? await service.getConnectedAccounts(userId) : null;

  res.json({
    success: true,
    platform,
    configured: service.isConfigured(),
    connected: !!accounts,
    account: accounts
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

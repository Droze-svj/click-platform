
const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const router = express.Router();

// OAuth Services
const twitterOAuth = require('../services/twitterOAuthService');
const tiktokOAuth = require('../services/tiktokOAuthService');
const youtubeOAuth = require('../services/youtubeOAuthService');
const instagramOAuth = require('../services/instagramOAuthService');
const linkedinOAuth = require('../services/linkedinOAuthService');
const facebookOAuth = require('../services/facebookOAuthService');
const User = require('../models/User');
const { isDevUser } = require('../utils/devUser');

function getServiceByPlatform(platform) {
  switch (platform.toLowerCase()) {
    case 'twitter': return twitterOAuth;
    case 'tiktok': return tiktokOAuth;
    case 'youtube': return youtubeOAuth;
    case 'instagram': return instagramOAuth;
    default: return null;
  }
}

/** Platforms using authorize+complete flow (return auth URL, frontend handles callback) */
const AUTHORIZE_FLOW_PLATFORMS = ['linkedin', 'facebook'];

/**
 * GET /api/oauth/:platform/connect
 * Initiate OAuth connection flow
 */
router.get('/:platform/connect', auth, asyncHandler(async (req, res) => {
  try {
    const { platform } = req.params;
    const plat = platform.toLowerCase();
    const { redirect_uri } = req.query;
    const baseRedirect = redirect_uri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social`;

    // LinkedIn/Facebook use authorize+complete flow
    if (plat === 'linkedin' && linkedinOAuth.isConfigured()) {
      const callbackUrl = linkedinOAuth.defaultRedirectUri?.(req) || `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5001'}/api/oauth/linkedin/callback`;
      const { url } = await linkedinOAuth.getAuthorizationUrl(req.user.id || req.user._id, callbackUrl);
      return res.json({ success: true, auth_url: url, state: null });
    }
    if (plat === 'facebook' && facebookOAuth.isConfigured()) {
      const callbackUrl = facebookOAuth.defaultRedirectUri?.() || `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5001'}/api/oauth/facebook/callback`;
      const { url } = await facebookOAuth.getAuthorizationUrl(req.user.id || req.user._id, callbackUrl);
      return res.json({ success: true, auth_url: url, state: null });
    }

    const service = getServiceByPlatform(platform);
    if (!service) {
      return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
    }
    if (!service.isConfigured()) {
      return res.status(400).json({ success: false, error: `${platform} OAuth not configured.` });
    }

    const statePayload = {
      userId: req.user.id || req.user._id,
      platform: plat,
      redirectUri: baseRedirect
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');

    let authUrl;
    if (plat === 'twitter' && service.getAuthorizationUrl) {
      const crypto = require('crypto');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      statePayload.codeVerifier = codeVerifier;
      const stateWithPkce = Buffer.from(JSON.stringify(statePayload)).toString('base64');
      const result = service.getAuthorizationUrl(stateWithPkce, codeVerifier);
      authUrl = typeof result === 'object' ? result.url : result;
    } else {
      authUrl = service.getAuthorizationUrl ? service.getAuthorizationUrl(state) : null;
    }
    if (!authUrl) {
      return res.status(500).json({ success: false, error: 'Failed to get authorization URL' });
    }
    res.json({ success: true, auth_url: authUrl, state });

  } catch (error) {
    logger.error('OAuth connect error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to initiate OAuth connection' });
  }
}));

/**
 * GET /api/oauth/:platform/callback
 * Handle OAuth callback and exchange code for tokens
 */
router.get('/:platform/callback', asyncHandler(async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state, error: oauthError, error_description } = req.query;
    const service = getServiceByPlatform(platform);

    if (oauthError) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state || !service) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=missing_params`);
    }

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { userId, redirectUri: originalRedirectUri, codeVerifier } = stateData;

    const tokens = await service.exchangeCodeForToken(code, codeVerifier);
    const profile = await service.getUserProfile(tokens.access_token);
    await service.connectAccount(userId, tokens, profile);

    logger.info(`OAuth connection successful for ${platform}`, { userId, profileId: profile.id });

    const successRedirectUri = `${originalRedirectUri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social`}?success=true&platform=${platform}`;
    res.redirect(successRedirectUri);

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=oauth_failed`);
  }
}));

/**
 * GET /api/oauth/accounts
 * Get user's connected social media accounts
 */
router.get('/accounts', auth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // Dev users (e.g. dev-user-123) use non-UUID/non-ObjectId IDs - skip OAuth lookups
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
          if (accs && accs.length > 0) accounts[p] = accs[0];
        } catch (e) { logger.warn(`Error fetching ${p} accounts:`, e?.message); }
      } else if (p === 'linkedin' && linkedinOAuth.getConnectionStatus) {
        try {
          const status = await linkedinOAuth.getConnectionStatus(userId);
          if (status?.connected && status?.platformUserId) {
            accounts[p] = {
              platform: 'linkedin',
              platform_user_id: status.platformUserId,
              username: status.platformUsername || status.platformUserId,
              display_name: status.platformUsername,
              is_connected: true,
              created_at: status.connectedAt
            };
          }
        } catch (e) { logger.warn('Error fetching LinkedIn status:', e?.message); }
      } else if (p === 'facebook' && facebookOAuth.isConfigured) {
        try {
          const user = await User.findById(userId).select('oauth.facebook').lean();
          const fb = user?.oauth?.facebook;
          if (fb?.connected && fb?.platformUserId) {
            accounts[p] = {
              platform: 'facebook',
              platform_user_id: fb.platformUserId,
              username: fb.platformUsername || fb.platformUserId,
              display_name: fb.platformUsername,
              is_connected: true,
              created_at: fb.connectedAt
            };
          }
        } catch (e) { logger.warn('Error fetching Facebook status:', e?.message); }
      }
    }

    res.json({ success: true, accounts });
  } catch (error) {
    logger.error('OAuth accounts error', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch connected accounts' });
  }
}));

/**
 * DELETE /api/oauth/:platform/disconnect
 */
router.delete('/:platform/disconnect', auth, asyncHandler(async (req, res) => {
  try {
    const { platform } = req.params;
    const plat = platform.toLowerCase();
    const userId = req.user.id || req.user._id;
    const { platform_user_id } = req.body;

    if (plat === 'linkedin' && linkedinOAuth.disconnectLinkedIn) {
      await linkedinOAuth.disconnectLinkedIn(userId);
      logger.info('LinkedIn account disconnected', { userId });
      return res.json({ success: true, message: 'LinkedIn disconnected successfully' });
    }
    if (plat === 'facebook' && facebookOAuth.disconnectFacebook) {
      await facebookOAuth.disconnectFacebook(userId);
      logger.info('Facebook account disconnected', { userId });
      return res.json({ success: true, message: 'Facebook disconnected successfully' });
    }

    const service = getServiceByPlatform(platform);
    if (!service || !platform_user_id) {
      return res.status(400).json({ success: false, error: 'Invalid parameters' });
    }

    await service.disconnectAccount(userId, platform_user_id);
    logger.info('Account disconnected', { platform: plat, userId, platform_user_id });

    res.json({ success: true, message: `${platform} disconnected successfully` });
  } catch (error) {
    logger.error('OAuth disconnect error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to disconnect account' });
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


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

function getServiceByPlatform(platform) {
  switch (platform.toLowerCase()) {
    case 'twitter': return twitterOAuth;
    case 'tiktok': return tiktokOAuth;
    case 'youtube': return youtubeOAuth;
    case 'instagram': return instagramOAuth;
    default: return null;
  }
}

/**
 * GET /api/oauth/:platform/connect
 * Initiate OAuth connection flow
 */
router.get('/:platform/connect', auth, asyncHandler(async (req, res) => {
  try {
    const { platform } = req.params;
    const { redirect_uri } = req.query;
    const service = getServiceByPlatform(platform);

    if (!service) {
      return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
    }

    if (!service.isConfigured()) {
      return res.status(400).json({ success: false, error: `${platform} OAuth not configured.` });
    }

    const state = Buffer.from(JSON.stringify({
      userId: req.user.id,
      platform,
      redirectUri: redirect_uri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social`
    })).toString('base64');

    const authUrl = service.getAuthorizationUrl(state);

    res.json({ success: true, auth_url: authUrl, state });

  } catch (error) {
    console.error('OAuth connect error:', error);
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
    const { userId, redirectUri: originalRedirectUri } = stateData;

    const tokens = await service.exchangeCodeForToken(code);
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
    const platforms = ['twitter', 'tiktok', 'youtube', 'instagram'];
    const accounts = {};

    for (const p of platforms) {
      const service = getServiceByPlatform(p);
      accounts[p] = null;
      if (service) {
        try {
          const accs = await service.getConnectedAccounts(req.user.id);
          if (accs.length > 0) accounts[p] = accs[0];
        } catch (e) { console.error(`Error fetching ${p} accounts:`, e); }
      }
    }

    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch connected accounts' });
  }
}));

/**
 * DELETE /api/oauth/:platform/disconnect
 */
router.delete('/:platform/disconnect', auth, asyncHandler(async (req, res) => {
  try {
    const { platform } = req.params;
    const { platform_user_id } = req.body;
    const service = getServiceByPlatform(platform);

    if (!service || !platform_user_id) {
      return res.status(400).json({ success: false, error: 'Invalid parameters' });
    }

    await service.disconnectAccount(req.user.id, platform_user_id);
    logger.info(`Account disconnected for ${platform}`, { userId: req.user.id, platform_user_id });

    res.json({ success: true, message: `${platform} disconnected successfully` });
  } catch (error) {
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
      instagram: instagramOAuth.isConfigured()
    }
  });
});

module.exports = router;

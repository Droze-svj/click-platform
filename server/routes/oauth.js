const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const router = express.Router();

// OAuth Services
const twitterOAuth = require('../services/twitterOAuthService');

/**
 * GET /api/oauth/:platform/connect
 * Initiate OAuth connection flow
 */
router.get('/:platform/connect', auth, asyncHandler(async (req, res) => {
  try {
    const { platform } = req.params;
    const { redirect_uri } = req.query;

    const state = Buffer.from(JSON.stringify({
      userId: req.user.id,
      platform,
      redirectUri: redirect_uri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social`
    })).toString('base64');

    let authUrl;

    switch (platform.toLowerCase()) {
      case 'twitter':
        if (!twitterOAuth.isConfigured()) {
          return res.status(400).json({
            success: false,
            error: 'Twitter OAuth not configured. Please contact administrator.'
          });
        }
        authUrl = twitterOAuth.getAuthorizationUrl(state);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported platform: ${platform}`
        });
    }

    res.json({
      success: true,
      auth_url: authUrl,
      state: state
    });

  } catch (error) {
    console.error('OAuth connect error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate OAuth connection'
    });
  }
}));

/**
 * GET /api/oauth/:platform/callback
 * Handle OAuth callback and exchange code for tokens
 */
router.get('/:platform/callback', async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state, error: oauthError, error_description } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=${encodeURIComponent(oauthError)}&description=${encodeURIComponent(error_description || '')}`;
      return res.redirect(redirectUri);
    }

    if (!code || !state) {
      const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=missing_code`;
      return res.redirect(redirectUri);
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (error) {
      const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=invalid_state`;
      return res.redirect(redirectUri);
    }

    const { userId, redirectUri: originalRedirectUri } = stateData;

    let tokens, profile, accountData;

    switch (platform.toLowerCase()) {
      case 'twitter':
        // Exchange code for tokens
        tokens = await twitterOAuth.exchangeCodeForToken(code);

        // Get user profile
        profile = await twitterOAuth.getUserProfile(tokens.access_token);

        // Connect account to user
        accountData = await twitterOAuth.connectAccount(userId, tokens, profile);
        break;

      default:
        const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=unsupported_platform`;
        return res.redirect(redirectUri);
    }

    logger.info(`OAuth connection successful for ${platform}`, { userId, platformUserId: profile.id });

    // Redirect back to frontend with success
    const successRedirectUri = `${originalRedirectUri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social`}?success=true&platform=${platform}`;
    res.redirect(successRedirectUri);

  } catch (error) {
    console.error('OAuth callback error:', error);

    const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=oauth_failed&description=${encodeURIComponent(error.message)}`;
    res.redirect(redirectUri);
  }
});

/**
 * GET /api/oauth/accounts
 * Get user's connected social media accounts
 */
router.get('/accounts', auth, asyncHandler(async (req, res) => {
  try {
    const accounts = {
      twitter: null,
      linkedin: null,
      facebook: null,
      instagram: null
    };

    // Get Twitter accounts
    try {
      const twitterAccounts = await twitterOAuth.getConnectedAccounts(req.user.id);
      if (twitterAccounts.length > 0) {
        accounts.twitter = twitterAccounts[0]; // Take the first one for now
      }
    } catch (error) {
      console.error('Error fetching Twitter accounts:', error);
    }

    // TODO: Add other platforms when implemented
    // accounts.linkedin = await linkedinOAuth.getConnectedAccounts(req.user.id);
    // accounts.facebook = await facebookOAuth.getConnectedAccounts(req.user.id);
    // accounts.instagram = await instagramOAuth.getConnectedAccounts(req.user.id);

    res.json({
      success: true,
      accounts
    });

  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch connected accounts'
    });
  }
}));

/**
 * DELETE /api/oauth/:platform/disconnect
 * Disconnect a social media account
 */
router.delete('/:platform/disconnect', auth, asyncHandler(async (req, res) => {
  try {
    const { platform } = req.params;
    const { platform_user_id } = req.body;

    if (!platform_user_id) {
      return res.status(400).json({
        success: false,
        error: 'Platform user ID is required'
      });
    }

    switch (platform.toLowerCase()) {
      case 'twitter':
        await twitterOAuth.disconnectAccount(req.user.id, platform_user_id);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported platform: ${platform}`
        });
    }

    logger.info(`Account disconnected for ${platform}`, { userId: req.user.id, platformUserId: platform_user_id });

    res.json({
      success: true,
      message: `${platform} account disconnected successfully`
    });

  } catch (error) {
    console.error('Disconnect account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect account'
    });
  }
}));

/**
 * GET /api/oauth/status
 * Get OAuth configuration status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    configured: {
      twitter: twitterOAuth.isConfigured(),
      linkedin: false, // TODO: implement
      facebook: false, // TODO: implement
      instagram: false  // TODO: implement
    }
  });
});

module.exports = router;

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { oauthLimiter, apiLimiter } = require('../middleware/enhancedRateLimiter');
const router = express.Router();

// OAuth Services
const twitterOAuth = require('../services/twitterOAuthService');
const tiktokOAuth = require('../services/tiktokOAuthService');
const youtubeOAuth = require('../services/youtubeOAuthService');
const instagramOAuth = require('../services/instagramOAuthService');
const linkedinOAuth = require('../services/linkedinOAuthService');
const facebookOAuth = require('../services/facebookOAuthService');
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
 * Initiate OAuth connection flow
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
    redirectUri: baseRedirect,
    createdAt: Date.now()
  };

  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');
  
  try {
    const callbackUrl = `${process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5001'}/api/oauth/${plat}/callback`;
    
    // Standardized getAuthorizationUrl(userId, state, callbackUrl)
    const result = await service.getAuthorizationUrl(userId, state, callbackUrl);
    const authUrl = typeof result === 'object' ? result.url : result;

    res.json({ success: true, auth_url: authUrl, state });
  } catch (error) {
    logger.error('OAuth connect error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to initiate OAuth connection' });
  }
}));

/**
 * Handle OAuth callback
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
    const { userId, redirectUri: originalRedirectUri } = stateData;

    // Standardized exchangeCodeForToken(userId, code, state)
    await service.exchangeCodeForToken(userId, code, state);

    logger.info(`OAuth connection successful for ${platform}`, { userId });

    const successRedirectUri = `${originalRedirectUri || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social`}?success=true&platform=${platform}`;
    res.redirect(successRedirectUri);

  } catch (error) {
    logger.error(`OAuth callback error for ${platform}:`, error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * Get user's active connections
 */
router.get('/connections', auth, apiLimiter, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const platforms = ['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'];
    const accounts = {};

    for (const p of platforms) {
      accounts[p] = null;
      const service = getServiceByPlatform(p);
      if (service && service.getConnectedAccounts) {
        try {
          const accs = await service.getConnectedAccounts(userId);
          if (accs) {
            // Standardize return: if array, take first, otherwise object
            accounts[p] = Array.isArray(accs) ? (accs.length > 0 ? accs[0] : null) : accs;
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

// Alias /accounts to /connections
router.get('/accounts', auth, apiLimiter, (req, res) => {
  req.url = '/connections';
  router.handle(req, res);
});

/**
 * Disconnect a social account
 */
router.delete('/:platform/disconnect', auth, apiLimiter, validateDisconnect, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const plat = platform.toLowerCase();
  const userId = req.user.id || req.user._id;

  const service = getServiceByPlatform(plat);
  if (!service) {
    return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
  }

  try {
    // Standardized disconnectAccount(userId)
    if (service.disconnectAccount) {
      await service.disconnectAccount(userId);
    } else {
      // Fallback for older naming if any
      const methodName = `disconnect${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
      if (service[methodName]) {
        await service[methodName](userId);
      } else {
        throw new Error('Disconnect method not found');
      }
    }

    res.json({ success: true, message: `${platform} disconnected successfully` });
  } catch (error) {
    logger.error('OAuth disconnect error', { error: error.message, platform });
    res.status(500).json({ success: false, error: 'Failed to disconnect account' });
  }
}));

/**
 * Get OAuth configuration status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    configured: {
      twitter: twitterOAuth.isConfigured(),
      tiktok: tiktokOAuth.isConfigured(),
      youtube: youtubeOAuth.isConfigured(),
      instagram: instagramOAuth.isConfigured(),
      linkedin: linkedinOAuth.isConfigured(),
      facebook: facebookOAuth.isConfigured()
    }
  });
});

module.exports = router;

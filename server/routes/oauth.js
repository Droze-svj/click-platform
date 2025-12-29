// OAuth callback routes for social media platforms

const express = require('express');
const auth = require('../middleware/auth');
const {
  getTwitterAuthUrl,
  exchangeTwitterToken,
  getTwitterUserInfo,
} = require('../services/oauthService');
const {
  getAuthorizationUrl: getLinkedInAuthUrl,
  isConfigured: isLinkedInConfigured,
} = require('../services/linkedinOAuthService');
const {
  getAuthorizationUrl: getFacebookAuthUrl,
  isConfigured: isFacebookConfigured,
} = require('../services/facebookOAuthService');
const {
  getAuthorizationUrl: getYouTubeAuthUrl,
  isConfigured: isYouTubeConfigured,
} = require('../services/youtubeOAuthService');
const {
  getAuthorizationUrl: getTikTokAuthUrl,
  isConfigured: isTikTokConfigured,
} = require('../services/tiktokOAuthService');
const { connectAccount } = require('../services/socialMediaService');
const { generateState, verifyState } = require('../utils/oauthStateManager');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * Get OAuth authorization URL
 */
router.get('/auth/:platform', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const userId = req.user._id;

  try {
    let authData;

    switch (platform.toLowerCase()) {
      case 'twitter':
        authData = getTwitterAuthUrl();
        break;
      case 'linkedin':
        if (!isLinkedInConfigured()) {
          return sendError(res, 'LinkedIn OAuth not configured', 503);
        }
        const linkedinCallbackUrl = process.env.LINKEDIN_CALLBACK_URL || 
          `${req.protocol}://${req.get('host')}/api/oauth/linkedin/callback`;
        authData = await getLinkedInAuthUrl(userId, linkedinCallbackUrl);
        // Convert to expected format
        authData = { authUrl: authData.url, state: authData.state };
        break;
      case 'facebook':
        if (!isFacebookConfigured()) {
          return sendError(res, 'Facebook OAuth not configured', 503);
        }
        const facebookCallbackUrl = process.env.FACEBOOK_CALLBACK_URL || 
          `${req.protocol}://${req.get('host')}/api/oauth/facebook/callback`;
        authData = await getFacebookAuthUrl(userId, facebookCallbackUrl);
        // Convert to expected format
        authData = { authUrl: authData.url, state: authData.state };
        break;
      case 'instagram':
        // Instagram requires Facebook connection first
        if (!isFacebookConfigured()) {
          return sendError(res, 'Facebook OAuth not configured (required for Instagram)', 503);
        }
        // For Instagram, we need to check if Facebook is connected first
        const User = require('../models/User');
        const user = await User.findById(userId).select('oauth.facebook');
        if (!user?.oauth?.facebook?.connected) {
          return sendError(res, 'Facebook account must be connected first for Instagram', 400);
        }
        // Instagram uses Facebook OAuth, but we'll redirect to get Instagram accounts
        return sendError(res, 'Please connect Facebook first, then use /api/oauth/instagram/accounts to get Instagram accounts', 400);
      case 'youtube':
        if (!isYouTubeConfigured()) {
          return sendError(res, 'YouTube OAuth not configured', 503);
        }
        const youtubeCallbackUrl = process.env.YOUTUBE_CALLBACK_URL || 
          `${req.protocol}://${req.get('host')}/api/oauth/youtube/callback`;
        authData = await getYouTubeAuthUrl(userId, youtubeCallbackUrl);
        // Convert to expected format
        authData = { authUrl: authData.url, state: authData.state };
        break;
      case 'tiktok':
        if (!isTikTokConfigured()) {
          return sendError(res, 'TikTok OAuth not configured', 503);
        }
        const tiktokCallbackUrl = process.env.TIKTOK_CALLBACK_URL || 
          `${req.protocol}://${req.get('host')}/api/oauth/tiktok/callback`;
        authData = await getTikTokAuthUrl(userId, tiktokCallbackUrl);
        // Convert to expected format
        authData = { authUrl: authData.url, state: authData.state };
        break;
      default:
        return sendError(res, 'Unsupported platform', 400);
    }

    // Generate and store state for verification (if not already done by service)
    if (!authData.state) {
      const state = generateState(userId, platform);
      authData.state = state;
      // Replace state in auth URL with our generated state
      authData.authUrl = authData.authUrl.replace(/state=[^&]+/, `state=${state}`);
    }

    sendSuccess(res, 'Authorization URL generated', 200, {
      authUrl: authData.authUrl,
      state: authData.state,
    });
  } catch (error) {
    logger.error('OAuth URL generation error', { error: error.message, platform });
    sendError(res, error.message, 500);
  }
}));

/**
 * OAuth callback handler
 */
router.get('/callback/:platform', asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const { code, state, error } = req.query;

  if (error) {
    logger.error('OAuth callback error', { error, platform });
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=no_code`);
  }

  if (!state) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=no_state`);
  }

  try {
    // Verify state (will be done on frontend with user session)
    // For now, we'll redirect to frontend with code and state
    // Frontend will call /complete endpoint with user auth
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?platform=${platform}&code=${code}&state=${state}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('OAuth callback processing error', { error: error.message, platform });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/social?error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * Complete OAuth connection (called from frontend after callback)
 */
router.post('/complete', auth, asyncHandler(async (req, res) => {
  const { platform, code, state } = req.body;
  const userId = req.user._id;

  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }

  try {
    // Use dedicated services for each platform
    switch (platform.toLowerCase()) {
      case 'twitter':
        // Verify state
        if (state && !verifyState(state, userId, platform)) {
          return sendError(res, 'Invalid or expired OAuth state', 400);
        }
        
        const tokenData = await exchangeTwitterToken(code);
        const userInfo = await getTwitterUserInfo(tokenData.accessToken);
        
        const expiresAt = tokenData.expiresIn
          ? new Date(Date.now() + tokenData.expiresIn * 1000)
          : null;

        const metadata = {
          expiresAt,
          platformUserId: userInfo.id,
          platformUsername: userInfo.username || userInfo.name,
          ...userInfo,
        };

        const connection = await connectAccount(
          userId,
          platform,
          tokenData.accessToken,
          tokenData.refreshToken,
          metadata
        );

        sendSuccess(res, 'Account connected successfully', 200, connection);
        break;

      case 'linkedin':
        // Redirect to dedicated LinkedIn route
        // The frontend should call /api/oauth/linkedin/complete instead
        return sendError(res, 'Please use /api/oauth/linkedin/complete endpoint', 400);

      case 'facebook':
        // Redirect to dedicated Facebook route
        // The frontend should call /api/oauth/facebook/complete instead
        return sendError(res, 'Please use /api/oauth/facebook/complete endpoint', 400);

      case 'instagram':
        // Instagram requires Facebook connection first
        return sendError(res, 'Instagram requires Facebook connection. Please connect Facebook first, then use /api/oauth/instagram/accounts', 400);

      case 'youtube':
        // Redirect to dedicated YouTube route
        return sendError(res, 'Please use /api/oauth/youtube/complete endpoint', 400);

      case 'tiktok':
        // Redirect to dedicated TikTok route
        return sendError(res, 'Please use /api/oauth/tiktok/complete endpoint', 400);

      default:
        return sendError(res, 'Unsupported platform', 400);
    }
  } catch (error) {
    logger.error('OAuth completion error', { error: error.message, platform, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;


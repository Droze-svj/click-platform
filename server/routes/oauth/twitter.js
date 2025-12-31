// Twitter OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getAuthorizationUrl,
  exchangeCodeForToken,
  postTweet,
  disconnectTwitter,
  isConfigured
} = require('../../services/twitterOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/oauth/twitter/authorize
 * Get Twitter OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    return sendError(res, 'Twitter OAuth not configured', 503);
  }

  // Use TWITTER_CALLBACK_URL if set, otherwise construct from request
  // In production, prefer environment variable to avoid localhost issues
  let callbackUrl = process.env.TWITTER_CALLBACK_URL;
  
  if (!callbackUrl) {
    // Fallback: construct from request, but prefer HTTPS in production
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
    const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:5001';
    callbackUrl = `${protocol}://${host}/api/oauth/twitter/callback`;
    
    // Log warning if using fallback in production
    if (process.env.NODE_ENV === 'production') {
      logger.warn('TWITTER_CALLBACK_URL not set, using fallback', { callbackUrl, host });
    }
  }

  const { url, state } = await getAuthorizationUrl(req.user._id, callbackUrl);
  
  sendSuccess(res, 'Authorization URL generated', 200, { url, state });
}));

/**
 * GET /api/oauth/twitter/callback
 * Handle Twitter OAuth callback
 */
router.get('/callback', oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return sendError(res, 'Missing authorization code or state', 400);
  }

  try {
    const { accessToken } = await exchangeCodeForToken(req.user._id, code, state);
    
    // Redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?connected=twitter&success=true`);
  } catch (error) {
    logger.error('Twitter OAuth callback error', { error: error.message, userId: req.user._id });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * POST /api/oauth/twitter/post
 * Post a tweet
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { text, replyTo, mediaIds } = req.body;

  if (!text || text.trim().length === 0) {
    return sendError(res, 'Tweet text is required', 400);
  }

  if (text.length > 280) {
    return sendError(res, 'Tweet text exceeds 280 characters', 400);
  }

  const options = {};
  if (replyTo) options.reply = { in_reply_to_tweet_id: replyTo };
  if (mediaIds && mediaIds.length > 0) options.media = { media_ids: mediaIds };

  const tweet = await postTweet(req.user._id, text, options);
  
  sendSuccess(res, 'Tweet posted successfully', 200, { tweet });
}));

/**
 * DELETE /api/oauth/twitter/disconnect
 * Disconnect Twitter account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  await disconnectTwitter(req.user._id);
  sendSuccess(res, 'Twitter account disconnected', 200);
}));

/**
 * GET /api/oauth/twitter/status
 * Get Twitter connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const User = require('../../models/User');
  const user = await User.findById(req.user._id).select('oauth.twitter');
  
  const connected = user?.oauth?.twitter?.connected || false;
  const connectedAt = user?.oauth?.twitter?.connectedAt;

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    connectedAt,
    configured: isConfigured()
  });
}));

module.exports = router;


// Twitter OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
// Import the singleton instance directly — destructuring its methods would
// drop the `this` binding and crash on the first call that touches state.
const twitterService = require('../../services/twitterOAuthService');
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
  if (!twitterService.isConfigured()) {
    return sendError(res, 'Twitter OAuth not configured', 503);
  }

  let callbackUrl = process.env.TWITTER_CALLBACK_URL;

  if (!callbackUrl) {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
    const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:5001';
    callbackUrl = `${protocol}://${host}/api/oauth/twitter/callback`;

    if (process.env.NODE_ENV === 'production') {
      logger.warn('TWITTER_CALLBACK_URL not set, using fallback', { callbackUrl, host });
    }
  }

  const userId = req.userId || req.user?._id || req.user?.id;

  // Create state payload
  const statePayload = {
    userId,
    platform: 'twitter',
    redirectUri: process.env.FRONTEND_URL || 'http://localhost:3000'
  };
  const crypto = require('crypto');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  statePayload.codeVerifier = codeVerifier;

  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');
  const url = await twitterService.getAuthorizationUrl(userId, state, callbackUrl);

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
    // The provider redirect carries no session, so derive the userId from the
    // signed-at-issue `state` blob (base64 JSON written by the authorize route).
    // Previously this read req.userId (always undefined here), so the token
    // exchange failed and Twitter could never finish connecting.
    let userId = req.userId || req.user?._id || req.user?.id;
    if (!userId && state) {
      try {
        const decoded = JSON.parse(Buffer.from(String(state), 'base64').toString('utf8'));
        if (decoded && decoded.userId) userId = decoded.userId;
      } catch (_) { /* malformed state handled below */ }
    }
    if (!userId) {
      return sendError(res, 'Invalid OAuth state', 400);
    }
    await twitterService.exchangeCodeForToken(userId, code, state);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?connected=twitter&success=true`);
  } catch (error) {
    logger.error('Twitter OAuth callback error', { error: error.message, userId: req.userId });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * POST /api/oauth/twitter/post
 * Post a tweet
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { text, replyTo, mediaIds, platform_user_id } = req.body;

  if (!text || text.trim().length === 0) {
    return sendError(res, 'Tweet text is required', 400);
  }

  if (text.length > 280) {
    return sendError(res, 'Tweet text exceeds 280 characters', 400);
  }

  const options = {};
  if (replyTo) options.reply = { in_reply_to_tweet_id: replyTo };
  if (mediaIds && mediaIds.length > 0) options.media = { media_ids: mediaIds };

  const userId = req.userId || req.user?._id || req.user?.id;
  const tweet = await twitterService.postTweetForUser(userId, text, options, platform_user_id);

  sendSuccess(res, 'Tweet posted successfully', 200, { tweet });
}));

/**
 * DELETE /api/oauth/twitter/disconnect
 * Disconnect Twitter account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  await twitterService.disconnectTwitter(userId);
  sendSuccess(res, 'Twitter account disconnected', 200);
}));

/**
 * GET /api/oauth/twitter/status
 * Get Twitter connection status (supports multiple X accounts)
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  const accounts = await twitterService.getConnectedAccounts(userId);
  const connected = Array.isArray(accounts) && accounts.length > 0;
  const firstAccount = accounts[0];

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    connectedAt: firstAccount?.connectedAt || null,
    accounts: accounts || [],
    configured: twitterService.isConfigured()
  });
}));

module.exports = router;

// Instagram OAuth Routes (via Facebook)

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
// The Instagram service exports a singleton instance — destructuring its
// methods drops the `this` binding, which previously crashed the /accounts
// endpoint with "Cannot read properties of undefined (reading 'isConfiguredFlag')".
const instagramService = require('../../services/instagramOAuthService');
const OAuthStorage = require('../../utils/oauthStorage');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const router = express.Router();

const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

/**
 * GET /api/oauth/instagram/accounts
 * Get Instagram Business accounts (requires Facebook connection)
 */
router.get('/accounts', auth, asyncHandler(async (req, res) => {
  if (!instagramService.isConfigured()) {
    return sendError(res, 'Facebook OAuth not configured (required for Instagram)', 503);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const accounts = await instagramService.getInstagramAccounts(userId);
  sendSuccess(res, 'Instagram accounts retrieved', 200, { accounts });
}));

/**
 * POST /api/oauth/instagram/post
 * Post an image (imageUrl) or a Reel (videoUrl) to Instagram.
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { imageUrl, videoUrl, isReel, caption, instagramAccountId, isCarousel, children } = req.body;
  const mediaUrl = videoUrl || imageUrl;

  if (!mediaUrl) {
    return sendError(res, 'An image or video URL is required for Instagram posts', 400);
  }

  const options = {};
  if (instagramAccountId) options.instagramAccountId = instagramAccountId;
  if (isCarousel) options.isCarousel = isCarousel;
  if (children) options.children = children;
  // Rendered exports are often signed URLs without a .mp4 suffix, so the
  // service can't sniff them — a videoUrl is always posted as a Reel.
  if (videoUrl || isReel) options.isReel = true;

  const userId = req.userId || req.user?._id || req.user?.id;
  const post = await instagramService.postToInstagram(userId, mediaUrl, caption || '', options);

  sendSuccess(res, 'Instagram post published successfully', 200, { post });
}));

// DELETE /api/oauth/instagram/disconnect is answered by the multi-account handler
// in routes/oauth.js (DELETE /:platform/disconnect). A copy here used to
// shadow it and ignore `accountId`, so disconnecting one account removed
// every account on the platform (Instagram removed the first one instead).

/**
 * GET /api/oauth/instagram/status
 * Get Instagram connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  let igRow = null;
  let fbRow = null;

  if (isMongoUserId(userId)) {
    const User = require('../../models/User');
    const user = await User.findById(userId).select('oauth.instagram oauth.facebook');
    igRow = user?.oauth?.instagram || null;
    fbRow = user?.oauth?.facebook || null;
  } else {
    // Supabase UUID — read social_links.oauth.<platform> via the unified storage
    igRow = await OAuthStorage.loadTokens(userId, 'instagram');
    fbRow = await OAuthStorage.loadTokens(userId, 'facebook');
  }

  const connected = !!igRow?.connected;
  const accounts = igRow?.accounts || [];
  const facebookConnected = !!fbRow?.connected;

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    accountsCount: accounts.length,
    accounts: accounts.map(acc => ({
      id: acc.id,
      username: acc.username,
      pageName: acc.pageName,
    })),
    facebookConnected, // Required for Instagram
    configured: instagramService.isConfigured()
  });
}));

module.exports = router;

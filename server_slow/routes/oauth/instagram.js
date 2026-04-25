// Instagram OAuth Routes (via Facebook)

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getInstagramAccounts,
  postToInstagram,
  disconnectInstagram,
  isConfigured
} = require('../../services/instagramOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/oauth/instagram/accounts
 * Get Instagram Business accounts (requires Facebook connection)
 */
router.get('/accounts', auth, asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    return sendError(res, 'Facebook OAuth not configured (required for Instagram)', 503);
  }

  const accounts = await getInstagramAccounts(req.user._id);
  sendSuccess(res, 'Instagram accounts retrieved', 200, { accounts });
}));

/**
 * POST /api/oauth/instagram/post
 * Post image to Instagram
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { imageUrl, caption, instagramAccountId, isCarousel, children } = req.body;

  if (!imageUrl) {
    return sendError(res, 'Image URL is required for Instagram posts', 400);
  }

  const options = {};
  if (instagramAccountId) options.instagramAccountId = instagramAccountId;
  if (isCarousel) options.isCarousel = isCarousel;
  if (children) options.children = children;

  const post = await postToInstagram(req.user._id, imageUrl, caption || '', options);
  
  sendSuccess(res, 'Instagram post published successfully', 200, { post });
}));

/**
 * DELETE /api/oauth/instagram/disconnect
 * Disconnect Instagram account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  await disconnectInstagram(req.user._id);
  sendSuccess(res, 'Instagram account disconnected', 200);
}));

/**
 * GET /api/oauth/instagram/status
 * Get Instagram connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const User = require('../../models/User');
  const user = await User.findById(req.user._id).select('oauth.instagram oauth.facebook');
  
  const connected = user?.oauth?.instagram?.connected || false;
  const accounts = user?.oauth?.instagram?.accounts || [];
  const facebookConnected = user?.oauth?.facebook?.connected || false;

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    accountsCount: accounts.length,
    accounts: accounts.map(acc => ({
      id: acc.id,
      username: acc.username,
      pageName: acc.pageName,
    })),
    facebookConnected, // Required for Instagram
    configured: isConfigured()
  });
}));

module.exports = router;




// Facebook OAuth Routes

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
// Singleton instance — destructuring would drop `this` and crash.
const facebookService = require('../../services/facebookOAuthService');
const OAuthStorage = require('../../utils/oauthStorage');
const { sendSuccess, sendError } = require('../../utils/response');
const { resolveOAuthCallbackUrl } = require('../../utils/oauthCallbackUrl');
const asyncHandler = require('../../middleware/asyncHandler');
const { recordDirectPost } = require('../../services/publishedPostRecorder');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const ssx = require('../../utils/oauthServerSideExchange');
const { ownUploadFile } = require('../../utils/ownUploadFile');
const { normalizeUploadsPath } = require('../../utils/mediaUrlSigner');
const router = express.Router();

const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

async function loadFacebookOauth(userId) {
  if (isMongoUserId(userId)) {
    const User = require('../../models/User');
    const user = await User.findById(userId).select('oauth.facebook');
    return user?.oauth?.facebook || null;
  }
  return await OAuthStorage.loadTokens(userId, 'facebook');
}

/**
 * GET /api/oauth/facebook/authorize
 * Get Facebook OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!facebookService.isConfigured()) {
    return sendError(res, 'Facebook OAuth not configured', 503);
  }

  const callbackUrl = process.env.FACEBOOK_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/oauth/facebook/callback`;

  const userId = req.userId || req.user?._id || req.user?.id;
  const { url, state } = await facebookService.getAuthorizationUrl(userId, callbackUrl);
  const finalUrl = ssx.serverSideExchangeEnabled() ? ssx.wrapAuthorizeUrl(url, userId, 'facebook') : url;

  sendSuccess(res, 'Authorization URL generated', 200, { url: finalUrl, state });
}));

// GET /api/oauth/facebook/callback is handled by the shared router
// (server/routes/oauth.js): it verifies the signed state, exchanges the code
// with the exact redirect_uri used at authorize time, saves the account and
// redirects to /dashboard/social. The handler that used to live here
// shadowed it and never finished the connection.

/**
 * POST /api/oauth/facebook/complete
 * Complete OAuth connection (called from frontend)
 */
router.post('/complete', auth, oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return sendError(res, 'Authorization code and state are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const { accessToken } = await facebookService.exchangeCodeForToken(userId, code, state, resolveOAuthCallbackUrl('facebook', req));

  const userInfo = await facebookService.getFacebookUserInfo(accessToken);
  const pages = await facebookService.getFacebookPages(accessToken);

  sendSuccess(res, 'Facebook account connected successfully', 200, {
    connected: true,
    userInfo: {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
    },
    pages: (pages || []).map(page => ({
      id: page.id,
      name: page.name,
    })),
  });
}));

/**
 * POST /api/oauth/facebook/post
 * Post to Facebook
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { text, pageId, link, imageUrl, videoUrl } = req.body;
  const caption = typeof text === 'string' ? text : '';

  if (!caption.trim() && !videoUrl) {
    return sendError(res, 'Post text or a video is required', 400);
  }
  // Our own /uploads files are sent to Meta as signed public links. Only sign a
  // file the caller was given access to (a valid signature, as everywhere else).
  for (const ref of [videoUrl, imageUrl]) {
    if (ref && normalizeUploadsPath(ref) && !ownUploadFile(ref)) {
      return sendError(res, 'This video link has expired. Render or open the video again, then post.', 403);
    }
  }

  const options = {};
  if (pageId) options.pageId = String(pageId);
  if (link) options.link = link;
  if (imageUrl) options.imageUrl = imageUrl;
  if (videoUrl) options.videoUrl = videoUrl;

  const userId = req.userId || req.user?._id || req.user?.id;
  const post = await facebookService.postToFacebook(userId, caption.trim(), options);
  await recordDirectPost({ userId, platform: 'facebook', result: post, contentId: req.body.contentId, caption });

  sendSuccess(res, 'Facebook post published successfully', 200, { post });
}));

/**
 * GET /api/oauth/facebook/pages
 * The creator's Facebook Pages (names only, never tokens) and the default one.
 */
router.get('/pages', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  sendSuccess(res, 'Facebook Pages', 200, await facebookService.listPages(userId));
}));

/**
 * PUT /api/oauth/facebook/default-page { pageId }
 * Which Page posts go to when none is chosen.
 */
router.put('/default-page', auth, asyncHandler(async (req, res) => {
  const pageId = req.body?.pageId;
  if (!pageId || typeof pageId !== 'string') return sendError(res, 'pageId is required', 400);
  const userId = req.userId || req.user?._id || req.user?.id;
  try {
    sendSuccess(res, 'Default Page updated', 200, await facebookService.setDefaultPage(userId, pageId));
  } catch (err) {
    if (err.statusCode === 404) return sendError(res, err.message, 404);
    throw err;
  }
}));

// DELETE /api/oauth/facebook/disconnect is answered by the multi-account handler
// in routes/oauth.js (DELETE /:platform/disconnect). A copy here used to
// shadow it and ignore `accountId`, so disconnecting one account removed
// every account on the platform (Instagram removed the first one instead).

/**
 * GET /api/oauth/facebook/status
 * Get Facebook connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  const fbRow = await loadFacebookOauth(userId);

  const connected = !!fbRow?.connected;
  const connectedAt = fbRow?.connectedAt;
  const pages = fbRow?.pages || [];

  sendSuccess(res, 'Status retrieved', 200, {
    connected,
    connectedAt,
    pagesCount: pages.length,
    configured: facebookService.isConfigured()
  });
}));

module.exports = router;

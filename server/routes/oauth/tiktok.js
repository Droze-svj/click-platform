// TikTok OAuth Routes

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
// Singleton instance — destructuring would drop `this` and crash.
const tiktokService = require('../../services/tiktokOAuthService');
const OAuthStorage = require('../../utils/oauthStorage');
const { sendSuccess, sendError } = require('../../utils/response');
const { resolveOAuthCallbackUrl } = require('../../utils/oauthCallbackUrl');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const { materializeVideoSource, ownUploadFile } = require('../../utils/ownUploadFile');
const { unescape: unescapeHtml } = require('validator');
const { verifyState } = require('../../utils/oauthState');
const router = express.Router();

const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

/**
 * GET /api/oauth/tiktok/authorize
 * Get TikTok OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!tiktokService.isConfigured()) {
    return sendError(res, 'TikTok OAuth not configured', 503);
  }

  // Resolved through the shared helper so the callback route's exchange can
  // derive the identical value — OAuth rejects the exchange otherwise.
  const callbackUrl = resolveOAuthCallbackUrl('tiktok', req);

  const userId = req.userId || req.user?._id || req.user?.id;
  const { url, state } = await tiktokService.getAuthorizationUrl(userId, callbackUrl);

  sendSuccess(res, 'Authorization URL generated', 200, { url, state });
}));

/**
 * GET /api/oauth/tiktok/callback
 * Handle TikTok OAuth callback
 */
router.get('/callback', oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('TikTok OAuth callback error', { error });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return sendError(res, 'Missing authorization code or state', 400);
  }

  try {
    const stateData = verifyState(state);
    if (!stateData || typeof stateData !== 'object' || !stateData.userId) {
      logger.warn(`TikTok OAuth callback received invalid/forged/expired state`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/dashboard/social?error=invalid_state`);
    }

    const { userId, redirectUri: originalRedirectUri } = stateData;

    // Exchange the code for token
    const tokens = await tiktokService.exchangeCodeForToken(code, resolveOAuthCallbackUrl('tiktok', req));
    const accessToken = tokens.access_token || tokens.accessToken;
    const profile = await tiktokService.getUserProfile(accessToken);
    
    // Connect the account
    await tiktokService.connectAccount(userId, tokens, profile);

    logger.info(`TikTok OAuth connection successful`, { userId });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successRedirectUri = `${originalRedirectUri || `${frontendUrl}/dashboard/social`}?success=true&platform=tiktok`;
    res.redirect(successRedirectUri);
  } catch (err) {
    logger.error('TikTok OAuth callback error', { error: err.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/social?error=${encodeURIComponent(err.message)}&platform=tiktok`);
  }
}));

/**
 * POST /api/oauth/tiktok/complete
 * Complete OAuth connection (called from frontend)
 */
router.post('/complete', auth, oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return sendError(res, 'Authorization code and state are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  // // Same value the authorize step used, so the two redirect_uri match.
  const tokens = await tiktokService.exchangeCodeForToken(code, resolveOAuthCallbackUrl('tiktok', req));
  const accessToken = tokens.access_token || tokens.accessToken;
  const userInfo = await tiktokService.getTikTokUserInfo(accessToken);

  await tiktokService.connectAccount(userId, tokens, userInfo);

  sendSuccess(res, 'TikTok account connected successfully', 200, {
    connected: true,
    userInfo: {
      open_id: userInfo.id || userInfo.open_id,
      display_name: userInfo.display_name,
      avatar: userInfo.avatar,
    },
  });
}));

/**
 * POST /api/oauth/tiktok/upload
 * Upload video to TikTok
 */
router.post('/upload', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  // Undo the global sanitizer's HTML-escaping: the URL is resolved to a file
  // and the caption goes to TikTok — neither is rendered as HTML here.
  const raw = (v) => (typeof v === 'string' ? unescapeHtml(v) : v);
  const videoFile = raw(req.body.videoFile);
  const caption = raw(req.body.caption);

  if (!videoFile || !caption) {
    return sendError(res, 'Video file and caption are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  // uploadVideoToTikTok(userId, videoPath, caption) needs a file on disk; the
  // client sends a media URL. Own signed /uploads media is read from disk,
  // remote media is downloaded (SSRF-guarded) and removed afterwards, and a
  // bare server path is refused.
  let source;
  try {
    source = await materializeVideoSource(videoFile, { prefix: 'tiktok' });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 400);
  }
  try {
    const video = await tiktokService.uploadVideoToTikTok(userId, source.path, caption);
    sendSuccess(res, 'TikTok video uploaded successfully', 200, { video });
  } finally {
    source.cleanup();
  }
}));

/**
 * POST /api/oauth/tiktok/post
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  // Undo the global sanitizer's HTML-escaping: an escaped "/" made every
  // videoUrl unfetchable and an escaped apostrophe leaked into captions.
  const raw = (v) => (typeof v === 'string' ? unescapeHtml(v) : v);
  const videoUrl = raw(req.body.videoUrl);
  const caption = raw(req.body.caption);

  if (!videoUrl || !caption) {
    return sendError(res, 'Video URL and caption are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  // Our own signed /uploads media is handed over as a local file — the
  // service would otherwise download it from ourselves over HTTP (blocked by
  // the SSRF guard on loopback, and broken once the signature expires).
  // Any other URL goes to the service's guarded remote download.
  const ownFile = ownUploadFile(videoUrl);
  // postToTikTok(userId, postData) — pass a {mediaUrl, caption} object, not a bare URL.
  const post = await tiktokService.postToTikTok(userId, ownFile
    ? { videoPath: ownFile, caption }
    : { mediaUrl: videoUrl, caption });

  sendSuccess(res, 'TikTok post published successfully', 200, { post });
}));

// DELETE /api/oauth/tiktok/disconnect is answered by the multi-account handler
// in routes/oauth.js (DELETE /:platform/disconnect). A copy here used to
// shadow it and ignore `accountId`, so disconnecting one account removed
// every account on the platform (Instagram removed the first one instead).

/**
 * GET /api/oauth/tiktok/status
 * Get TikTok connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  let ttRow = null;

  if (isMongoUserId(userId)) {
    const User = require('../../models/User');
    const user = await User.findById(userId).select('oauth.tiktok');
    ttRow = user?.oauth?.tiktok || null;
  } else {
    ttRow = await OAuthStorage.loadTokens(userId, 'tiktok');
  }

  sendSuccess(res, 'Status retrieved', 200, {
    connected: !!ttRow?.connected,
    connectedAt: ttRow?.connectedAt,
    username: ttRow?.platformUsername,
    configured: tiktokService.isConfigured()
  });
}));

module.exports = router;

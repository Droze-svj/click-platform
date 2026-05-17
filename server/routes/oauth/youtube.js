// YouTube OAuth Routes

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
// Singleton instance — destructuring would drop `this` and crash.
const youtubeService = require('../../services/youtubeOAuthService');
const OAuthStorage = require('../../utils/oauthStorage');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

/**
 * GET /api/oauth/youtube/authorize
 * Get YouTube OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!youtubeService.isConfigured()) {
    return sendError(res, 'YouTube OAuth not configured', 503);
  }

  let callbackUrl = process.env.YOUTUBE_CALLBACK_URL;

  if (!callbackUrl) {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
    const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:5001';
    callbackUrl = `${protocol}://${host}/api/oauth/youtube/callback`;

    if (process.env.NODE_ENV === 'production') {
      logger.warn('YOUTUBE_CALLBACK_URL not set, using fallback', { callbackUrl, host });
    }
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const { url, state } = await youtubeService.getAuthorizationUrl(userId, callbackUrl);

  sendSuccess(res, { url, state }, 'Authorization URL generated', 200);
}));

/**
 * GET /api/oauth/youtube/callback
 * Handle YouTube OAuth callback
 */
router.get('/callback', oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('YouTube OAuth callback error', { error });
    return res.send(`<!DOCTYPE html><html><head><title>YouTube OAuth Error</title></head><body style="font-family: Arial; padding: 40px; text-align: center;"><h1>OAuth Error</h1><p>Error: ${String(error).replace(/[<>&"]/g, '')}</p></body></html>`);
  }

  if (!code || !state) {
    return res.send(`<!DOCTYPE html><html><head><title>Missing Parameters</title></head><body style="font-family: Arial; padding: 40px; text-align: center;"><h1>Missing Parameters</h1></body></html>`);
  }

  // Show success page (kept as-is for the helper-script flow; sanitised inputs)
  const safeCode = String(code).replace(/[<>&"]/g, '');
  const safeState = String(state).replace(/[<>&"]/g, '');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>YouTube OAuth - Authorization Successful</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .code-box { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin: 10px 0; word-break: break-all; }
      </style>
    </head>
    <body>
      <h1>YouTube Authorization Successful</h1>
      <div class="success"><p>Use the code below to complete the connection.</p></div>
      <p><strong>Code:</strong></p>
      <div class="code-box">${safeCode}</div>
      <p><strong>State:</strong></p>
      <div class="code-box">${safeState}</div>
    </body>
    </html>
  `);
}));

/**
 * POST /api/oauth/youtube/complete
 * Complete OAuth connection (called from frontend)
 */
router.post('/complete', auth, oauthTokenLimiter, asyncHandler(async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return sendError(res, 'Authorization code and state are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;

  try {
    logger.info('Starting YouTube OAuth token exchange', { userId, hasCode: !!code, hasState: !!state });

    const { accessToken } = await youtubeService.exchangeCodeForToken(userId, code, state);

    logger.info('Token exchange successful, fetching user info', { userId });

    const userInfo = await youtubeService.getYouTubeUserInfo(accessToken);

    logger.info('YouTube OAuth connection completed', { userId, channelId: userInfo.id });

    sendSuccess(res, {
      connected: true,
      userInfo: {
        id: userInfo.id,
        title: userInfo.title,
        subscriberCount: userInfo.subscriberCount,
      },
    }, 'YouTube account connected successfully', 200);
  } catch (error) {
    logger.error('YouTube OAuth completion error', {
      error: error.message,
      userId,
      errorResponse: error.response?.data,
      errorStatus: error.response?.status
    });

    if (error.message.includes('Invalid OAuth state')) {
      return sendError(res, 'Invalid OAuth state. Please start the authorization flow again.', 400);
    }
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      return sendError(res, 'Authorization code expired or already used. Please start the authorization flow again.', 400);
    }
    if (error.response?.status === 400 && error.response?.data?.error === 'redirect_uri_mismatch') {
      return sendError(res, 'Redirect URI mismatch. Please ensure YOUTUBE_CALLBACK_URL is set correctly.', 400);
    }
    throw error;
  }
}));

/**
 * POST /api/oauth/youtube/upload
 * Upload video to YouTube
 */
router.post('/upload', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { videoFile, title, description, options } = req.body;

  if (!videoFile || !title) {
    return sendError(res, 'Video file and title are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const video = await youtubeService.uploadVideoToYouTube(userId, videoFile, title, description || '', options || {});

  sendSuccess(res, 'YouTube video uploaded successfully', 200, { video });
}));

/**
 * POST /api/oauth/youtube/post
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { videoUrl, title, description, options } = req.body;

  if (!videoUrl || !title) {
    return sendError(res, 'Video URL and title are required', 400);
  }

  const userId = req.userId || req.user?._id || req.user?.id;
  const post = await youtubeService.postToYouTube(userId, videoUrl, title, description || '', options || {});

  sendSuccess(res, 'YouTube post published successfully', 200, { post });
}));

/**
 * DELETE /api/oauth/youtube/disconnect
 * Disconnect YouTube account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  await youtubeService.disconnectYouTube(userId);
  sendSuccess(res, 'YouTube account disconnected', 200);
}));

/**
 * GET /api/oauth/youtube/status
 * Get YouTube connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?._id || req.user?.id;
  let ytRow = null;

  if (isMongoUserId(userId)) {
    const User = require('../../models/User');
    const user = await User.findById(userId).select('oauth.youtube');
    ytRow = user?.oauth?.youtube || null;
  } else {
    ytRow = await OAuthStorage.loadTokens(userId, 'youtube');
  }

  sendSuccess(res, {
    connected: !!ytRow?.connected,
    connectedAt: ytRow?.connectedAt,
    channelId: ytRow?.channelId,
    configured: youtubeService.isConfigured()
  }, 'Status retrieved', 200);
}));

module.exports = router;

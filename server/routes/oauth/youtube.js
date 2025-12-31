// YouTube OAuth Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getAuthorizationUrl,
  exchangeCodeForToken,
  uploadVideoToYouTube,
  postToYouTube,
  disconnectYouTube,
  isConfigured
} = require('../../services/youtubeOAuthService');
const { sendSuccess, sendError } = require('../../utils/response');
const asyncHandler = require('../../middleware/asyncHandler');
const { oauthAuthLimiter, oauthTokenLimiter, oauthPostLimiter } = require('../../middleware/oauthRateLimiter');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * GET /api/oauth/youtube/authorize
 * Get YouTube OAuth authorization URL
 */
router.get('/authorize', auth, oauthAuthLimiter, asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    return sendError(res, 'YouTube OAuth not configured', 503);
  }

  // Use YOUTUBE_CALLBACK_URL if set, otherwise construct from request
  // In production, prefer environment variable to avoid localhost issues
  let callbackUrl = process.env.YOUTUBE_CALLBACK_URL;
  
  if (!callbackUrl) {
    // Fallback: construct from request, but prefer HTTPS in production
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
    const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:5001';
    callbackUrl = `${protocol}://${host}/api/oauth/youtube/callback`;
    
    // Log warning if using fallback in production
    if (process.env.NODE_ENV === 'production') {
      logger.warn('YOUTUBE_CALLBACK_URL not set, using fallback', { callbackUrl, host });
    }
  }

  const { url, state } = await getAuthorizationUrl(req.user._id, callbackUrl);
  
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
    // Show error page with instructions
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>YouTube OAuth Error</title></head>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h1>❌ OAuth Error</h1>
        <p>Error: ${error}</p>
        <p>Please try again or contact support.</p>
      </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>YouTube OAuth - Missing Parameters</title></head>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h1>⚠️ Missing Parameters</h1>
        <p>Authorization code or state is missing.</p>
        <p>Please try the OAuth flow again.</p>
      </body>
      </html>
    `);
  }

  try {
    // Show success page with code and instructions
    // Always show the manual completion page for now (frontend can be added later)
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>YouTube OAuth - Authorization Successful</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .code-box { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin: 10px 0; word-break: break-all; }
          .button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px 5px; }
          .button:hover { background: #0056b3; }
          .instructions { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>✅ YouTube Authorization Successful!</h1>
        <div class="success">
          <p><strong>Your YouTube account has been authorized!</strong></p>
          <p>Copy the authorization code below to complete the connection.</p>
        </div>
        
        <div class="instructions">
          <h3>📋 Next Steps:</h3>
          <p><strong>Option 1: Use the helper script</strong></p>
          <p>Run this command in your terminal:</p>
          <div class="code-box">
            <code>./scripts/finish-youtube-oauth.sh "${code}" "${state}"</code>
          </div>
          
          <p><strong>Option 2: Manual completion</strong></p>
          <p>Copy the code and state, then use the API:</p>
          <div class="code-box">
            <code>curl -X POST "http://localhost:5001/api/oauth/youtube/complete" \\<br>
&nbsp;&nbsp;-H "Authorization: Bearer YOUR_TOKEN" \\<br>
&nbsp;&nbsp;-H "Content-Type: application/json" \\<br>
&nbsp;&nbsp;-d '{"code": "${code}", "state": "${state}"}'</code>
          </div>
        </div>
        
        <h3>📝 Authorization Details:</h3>
        <p><strong>Code:</strong></p>
        <div class="code-box">${code}</div>
        
        <p><strong>State:</strong></p>
        <div class="code-box">${state}</div>
        
        <p style="margin-top: 30px; color: #666;">
          <small>This page will help you complete the OAuth connection. The authorization code is valid for a few minutes.</small>
        </p>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('YouTube OAuth callback error', { error: error.message });
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>YouTube OAuth Error</title></head>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h1>❌ Error</h1>
        <p>${error.message}</p>
        <p>Please try again.</p>
      </body>
      </html>
    `);
  }
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

  try {
    logger.info('Starting YouTube OAuth token exchange', { 
      userId: req.user._id,
      hasCode: !!code,
      hasState: !!state,
      codeLength: code?.length,
      stateLength: state?.length
    });

    const { accessToken } = await exchangeCodeForToken(req.user._id, code, state);
    
    logger.info('Token exchange successful, fetching user info', { userId: req.user._id });
    
    // Get user info for response
    const { getYouTubeUserInfo } = require('../../services/youtubeOAuthService');
    const userInfo = await getYouTubeUserInfo(accessToken);
    
    logger.info('YouTube OAuth connection completed successfully', { 
      userId: req.user._id,
      channelId: userInfo.id,
      channelTitle: userInfo.title
    });
    
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
      stack: error.stack,
      userId: req.user._id,
      errorResponse: error.response?.data,
      errorStatus: error.response?.status
    });
    
    // Provide more specific error messages
    if (error.message.includes('Invalid OAuth state')) {
      return sendError(res, 'Invalid OAuth state. Please start the authorization flow again.', 400);
    }
    
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      return sendError(res, 'Authorization code expired or already used. Please start the authorization flow again.', 400);
    }
    
    if (error.response?.status === 400 && error.response?.data?.error === 'redirect_uri_mismatch') {
      return sendError(res, 'Redirect URI mismatch. Please ensure YOUTUBE_CALLBACK_URL is set correctly in environment variables.', 400);
    }
    
    // Re-throw to let asyncHandler handle it
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

  const video = await uploadVideoToYouTube(req.user._id, videoFile, title, description || '', options || {});
  
  sendSuccess(res, 'YouTube video uploaded successfully', 200, { video });
}));

/**
 * POST /api/oauth/youtube/post
 * Post to YouTube (placeholder for future implementation)
 */
router.post('/post', auth, oauthPostLimiter, asyncHandler(async (req, res) => {
  const { videoUrl, title, description, options } = req.body;

  if (!videoUrl || !title) {
    return sendError(res, 'Video URL and title are required', 400);
  }

  const post = await postToYouTube(req.user._id, videoUrl, title, description || '', options || {});
  
  sendSuccess(res, 'YouTube post published successfully', 200, { post });
}));

/**
 * DELETE /api/oauth/youtube/disconnect
 * Disconnect YouTube account
 */
router.delete('/disconnect', auth, asyncHandler(async (req, res) => {
  await disconnectYouTube(req.user._id);
  sendSuccess(res, 'YouTube account disconnected', 200);
}));

/**
 * GET /api/oauth/youtube/status
 * Get YouTube connection status
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const User = require('../../models/User');
  const user = await User.findById(req.user._id).select('oauth.youtube');
  
  const connected = user?.oauth?.youtube?.connected || false;
  const connectedAt = user?.oauth?.youtube?.connectedAt;
  const channelId = user?.oauth?.youtube?.channelId;

  sendSuccess(res, {
    connected,
    connectedAt,
    channelId,
    configured: isConfigured()
  }, 'Status retrieved', 200);
}));

module.exports = router;



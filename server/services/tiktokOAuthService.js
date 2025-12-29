// TikTok OAuth Service

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const User = require('../models/User');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

/**
 * Check if TikTok OAuth is configured
 */
function isConfigured() {
  return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl(userId, callbackUrl) {
  try {
    if (!isConfigured()) {
      throw new Error('TikTok OAuth not configured');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const scope = 'user.info.basic,video.upload,video.publish';
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/` +
      `?client_key=${clientKey}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`;

    // Store state in user's OAuth data
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.tiktok.state': state,
      }
    });

    return { url: authUrl, state };
  } catch (error) {
    logger.error('TikTok OAuth URL generation error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(userId, code, state) {
  try {
    if (!isConfigured()) {
      throw new Error('TikTok OAuth not configured');
    }

    // Verify state
    const user = await User.findById(userId);
    if (!user || !user.oauth?.tiktok?.state || user.oauth.tiktok.state !== state) {
      throw new Error('Invalid OAuth state');
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_CALLBACK_URL || 
      `${process.env.FRONTEND_URL || 'http://localhost:5001'}/api/oauth/tiktok/callback`;

    // Exchange code for token
    const response = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
      client_key: clientKey,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, expires_in, refresh_expires_in, scope, token_type } = response.data.data;

    // Get user info
    const userInfo = await getTikTokUserInfo(access_token);

    // Save tokens to user
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.tiktok.accessToken': access_token,
        'oauth.tiktok.refreshToken': refresh_token,
        'oauth.tiktok.connected': true,
        'oauth.tiktok.connectedAt': new Date(),
        'oauth.tiktok.expiresAt': expires_in 
          ? new Date(Date.now() + expires_in * 1000) 
          : null,
        'oauth.tiktok.refreshExpiresAt': refresh_expires_in 
          ? new Date(Date.now() + refresh_expires_in * 1000) 
          : null,
        'oauth.tiktok.platformUserId': userInfo.open_id,
        'oauth.tiktok.platformUsername': userInfo.display_name,
        'oauth.tiktok.scope': scope,
      },
      $unset: {
        'oauth.tiktok.state': '',
      }
    });

    logger.info('TikTok OAuth token exchange successful', { userId });

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    };
  } catch (error) {
    logger.error('TikTok OAuth token exchange error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get TikTok user info
 */
async function getTikTokUserInfo(accessToken) {
  try {
    const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: {
        fields: 'open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count',
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return response.data.data.user;
  } catch (error) {
    logger.error('TikTok user info error', { error: error.message });
    throw error;
  }
}

/**
 * Get TikTok client (for API calls)
 */
async function getTikTokClient(userId) {
  const user = await User.findById(userId).select('oauth.tiktok');
  
  if (!user || !user.oauth?.tiktok?.connected || !user.oauth.tiktok.accessToken) {
    throw new Error('TikTok account not connected');
  }

  // Check if token is expired and refresh if needed
  if (user.oauth.tiktok.expiresAt && new Date() > user.oauth.tiktok.expiresAt) {
    if (user.oauth.tiktok.refreshToken) {
      await refreshAccessToken(userId);
      // Reload user after refresh
      const refreshedUser = await User.findById(userId).select('oauth.tiktok');
      return refreshedUser.oauth.tiktok.accessToken;
    } else {
      throw new Error('TikTok token expired and no refresh token available');
    }
  }

  return user.oauth.tiktok.accessToken;
}

/**
 * Refresh access token
 */
async function refreshAccessToken(userId) {
  try {
    const user = await User.findById(userId).select('oauth.tiktok');
    
    if (!user || !user.oauth?.tiktok?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    const response = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: user.oauth.tiktok.refreshToken,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, expires_in, refresh_expires_in } = response.data.data;

    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.tiktok.accessToken': access_token,
        'oauth.tiktok.refreshToken': refresh_token || user.oauth.tiktok.refreshToken,
        'oauth.tiktok.expiresAt': expires_in 
          ? new Date(Date.now() + expires_in * 1000) 
          : null,
        'oauth.tiktok.refreshExpiresAt': refresh_expires_in 
          ? new Date(Date.now() + refresh_expires_in * 1000) 
          : null,
      }
    });

    logger.info('TikTok token refreshed', { userId });
    return access_token;
  } catch (error) {
    logger.error('TikTok token refresh error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Upload video to TikTok
 */
async function uploadVideoToTikTok(userId, videoFile, caption, options = {}, retries = 1) {
  try {
    const accessToken = await getTikTokClient(userId);
    
    // Step 1: Initialize upload
    const initResponse = await axios.post('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      post_info: {
        title: caption || '',
        privacy_level: options.privacyLevel || 'PUBLIC_TO_EVERYONE', // PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY
        disable_duet: options.disableDuet || false,
        disable_comment: options.disableComment || false,
        disable_stitch: options.disableStitch || false,
        video_cover_timestamp_ms: options.coverTimestamp || 1000,
      },
      source_info: {
        source: 'FILE_UPLOAD',
      },
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const { publish_id, upload_url } = initResponse.data.data;

    // Step 2: Upload video file
    await retryWithBackoff(
      async () => {
        return await axios.put(upload_url, videoFile, {
          headers: {
            'Content-Type': 'video/mp4',
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });
      },
      {
        maxRetries: retries,
        initialDelay: 2000,
        onRetry: (attempt, error) => {
          logger.warn('TikTok video upload retry', { attempt, error: error.message, userId });
        },
      }
    );

    // Step 3: Publish video
    const publishResponse = await retryWithBackoff(
      async () => {
        return await axios.post(`https://open.tiktokapis.com/v2/post/publish/status/fetch/?publish_id=${publish_id}`, null, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      },
      {
        maxRetries: retries,
        initialDelay: 2000,
        onRetry: (attempt, error) => {
          logger.warn('TikTok publish retry', { attempt, error: error.message, userId });
        },
      }
    );

    logger.info('TikTok video uploaded successfully', { 
      userId, 
      publishId: publish_id,
      status: publishResponse.data.data.status 
    });
    
    return {
      id: publish_id,
      url: `https://www.tiktok.com/@${user.oauth.tiktok.platformUsername}/video/${publish_id}`,
      caption: caption,
      status: publishResponse.data.data.status,
    };
  } catch (error) {
    logger.error('TikTok video upload error', { error: error.message, userId });
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      throw new Error(`Rate limit exceeded. Please try again after ${retryAfter} seconds.`);
    }
    
    throw error;
  }
}

/**
 * Post video URL to TikTok (if video is already uploaded elsewhere)
 */
async function postToTikTok(userId, videoUrl, caption, options = {}) {
  try {
    if (!videoUrl) {
      throw new Error('Video URL is required for TikTok posts');
    }

    // Download video from URL (if needed)
    // Then upload using uploadVideoToTikTok
    
    // For now, return a placeholder response
    // In production, implement video download and upload
    throw new Error('Direct video URL posting not yet implemented. Please upload video file directly.');
  } catch (error) {
    logger.error('TikTok post error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Disconnect TikTok account
 */
async function disconnectTikTok(userId) {
  try {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        'oauth.tiktok': '',
      }
    });

    logger.info('TikTok account disconnected', { userId });
  } catch (error) {
    logger.error('TikTok disconnect error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  isConfigured,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getTikTokUserInfo,
  getTikTokClient,
  refreshAccessToken,
  uploadVideoToTikTok,
  postToTikTok,
  disconnectTikTok,
};



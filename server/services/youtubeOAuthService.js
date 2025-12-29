// YouTube OAuth Service

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const User = require('../models/User');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
// Google APIs for YouTube (optional - will work without it for basic OAuth)
let google;
try {
  google = require('googleapis').google;
} catch (error) {
  logger.warn('googleapis not installed. YouTube video upload will require it.');
}

/**
 * Check if YouTube OAuth is configured
 */
function isConfigured() {
  return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl(userId, callbackUrl) {
  try {
    if (!isConfigured()) {
      throw new Error('YouTube OAuth not configured');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl';
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${state}`;

    // Store state in user's OAuth data
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.youtube.state': state,
      }
    });

    return { url: authUrl, state };
  } catch (error) {
    logger.error('YouTube OAuth URL generation error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(userId, code, state) {
  try {
    if (!isConfigured()) {
      throw new Error('YouTube OAuth not configured');
    }

    // Verify state
    const user = await User.findById(userId);
    if (!user || !user.oauth?.youtube?.state || user.oauth.youtube.state !== state) {
      throw new Error('Invalid OAuth state');
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_CALLBACK_URL || 
      `${process.env.FRONTEND_URL || 'http://localhost:5001'}/api/oauth/youtube/callback`;

    // Exchange code for token
    const response = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Get user info
    const userInfo = await getYouTubeUserInfo(access_token);

    // Save tokens to user
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.youtube.accessToken': access_token,
        'oauth.youtube.refreshToken': refresh_token,
        'oauth.youtube.connected': true,
        'oauth.youtube.connectedAt': new Date(),
        'oauth.youtube.expiresAt': expires_in 
          ? new Date(Date.now() + expires_in * 1000) 
          : null,
        'oauth.youtube.platformUserId': userInfo.id,
        'oauth.youtube.platformUsername': userInfo.title,
        'oauth.youtube.channelId': userInfo.id,
      },
      $unset: {
        'oauth.youtube.state': '',
      }
    });

    logger.info('YouTube OAuth token exchange successful', { userId });

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    };
  } catch (error) {
    logger.error('YouTube OAuth token exchange error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get YouTube user info (channel info)
 */
async function getYouTubeUserInfo(accessToken) {
  try {
    if (!google) {
      // Fallback: Use direct API call if googleapis not available
      const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'snippet,contentDetails,statistics',
          mine: true,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
          id: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description,
          thumbnail: channel.snippet.thumbnails?.default?.url,
          subscriberCount: channel.statistics?.subscriberCount,
        };
      }
    } else {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      const response = await youtube.channels.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        mine: true,
      });

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
          id: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description,
          thumbnail: channel.snippet.thumbnails?.default?.url,
          subscriberCount: channel.statistics?.subscriberCount,
        };
      }
    }

    throw new Error('No YouTube channel found');
  } catch (error) {
    logger.error('YouTube user info error', { error: error.message });
    throw error;
  }
}

/**
 * Get YouTube client (for API calls)
 */
async function getYouTubeClient(userId) {
  const user = await User.findById(userId).select('oauth.youtube');
  
  if (!user || !user.oauth?.youtube?.connected || !user.oauth.youtube.accessToken) {
    throw new Error('YouTube account not connected');
  }

  // Check if token is expired and refresh if needed
  if (user.oauth.youtube.expiresAt && new Date() > user.oauth.youtube.expiresAt) {
    if (user.oauth.youtube.refreshToken) {
      await refreshAccessToken(userId);
      // Reload user after refresh
      const refreshedUser = await User.findById(userId).select('oauth.youtube');
      return refreshedUser.oauth.youtube.accessToken;
    } else {
      throw new Error('YouTube token expired and no refresh token available');
    }
  }

  return user.oauth.youtube.accessToken;
}

/**
 * Refresh access token
 */
async function refreshAccessToken(userId) {
  try {
    const user = await User.findById(userId).select('oauth.youtube');
    
    if (!user || !user.oauth?.youtube?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    const response = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: user.oauth.youtube.refreshToken,
        grant_type: 'refresh_token',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, expires_in } = response.data;

    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.youtube.accessToken': access_token,
        'oauth.youtube.expiresAt': expires_in 
          ? new Date(Date.now() + expires_in * 1000) 
          : null,
      }
    });

    logger.info('YouTube token refreshed', { userId });
    return access_token;
  } catch (error) {
    logger.error('YouTube token refresh error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Upload video to YouTube
 */
async function uploadVideoToYouTube(userId, videoFile, title, description, options = {}, retries = 1) {
  try {
    if (!google) {
      throw new Error('googleapis package is required for YouTube video upload. Please install it: npm install googleapis');
    }

    const accessToken = await getYouTubeClient(userId);
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Get user's channel ID
    const user = await User.findById(userId).select('oauth.youtube');
    const channelId = user.oauth.youtube.channelId;

    // Video metadata
    const videoMetadata = {
      snippet: {
        title: title,
        description: description || '',
        tags: options.tags || [],
        categoryId: options.categoryId || '22', // People & Blogs
        defaultLanguage: options.language || 'en',
        defaultAudioLanguage: options.audioLanguage || 'en',
      },
      status: {
        privacyStatus: options.privacyStatus || 'public', // public, unlisted, private
        selfDeclaredMadeForKids: options.madeForKids || false,
      },
    };

    // Upload video
    const response = await retryWithBackoff(
      async () => {
        return await youtube.videos.insert({
          part: ['snippet', 'status'],
          requestBody: videoMetadata,
          media: {
            body: videoFile, // File stream or buffer
          },
        });
      },
      {
        maxRetries: retries,
        initialDelay: 2000,
        onRetry: (attempt, error) => {
          logger.warn('YouTube video upload retry', { attempt, error: error.message, userId });
        },
      }
    );

    logger.info('YouTube video uploaded successfully', { 
      userId, 
      videoId: response.data.id,
      channelId 
    });
    
    return {
      id: response.data.id,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
      title: title,
      description: description,
    };
  } catch (error) {
    logger.error('YouTube video upload error', { error: error.message, userId });
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      throw new Error(`Rate limit exceeded. Please try again after ${retryAfter} seconds.`);
    }
    
    throw error;
  }
}

/**
 * Post video URL to YouTube (if video is already uploaded elsewhere)
 */
async function postToYouTube(userId, videoUrl, title, description, options = {}) {
  try {
    // For YouTube, we typically need to upload the video file
    // This function can be used if you have a video URL that needs to be downloaded and uploaded
    // Or if you're creating a YouTube Short from existing content
    
    if (!videoUrl) {
      throw new Error('Video URL is required for YouTube posts');
    }

    // Download video from URL (if needed)
    // Then upload using uploadVideoToYouTube
    
    // For now, return a placeholder response
    // In production, implement video download and upload
    throw new Error('Direct video URL posting not yet implemented. Please upload video file directly.');
  } catch (error) {
    logger.error('YouTube post error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Disconnect YouTube account
 */
async function disconnectYouTube(userId) {
  try {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        'oauth.youtube': '',
      }
    });

    logger.info('YouTube account disconnected', { userId });
  } catch (error) {
    logger.error('YouTube disconnect error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  isConfigured,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getYouTubeUserInfo,
  getYouTubeClient,
  refreshAccessToken,
  uploadVideoToYouTube,
  postToYouTube,
  disconnectYouTube,
};


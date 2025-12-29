// Facebook OAuth Service

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const User = require('../models/User');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

/**
 * Check if Facebook OAuth is configured
 */
function isConfigured() {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl(userId, callbackUrl) {
  try {
    if (!isConfigured()) {
      throw new Error('Facebook OAuth not configured');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const scope = 'pages_manage_posts,pages_read_engagement,pages_show_list,public_profile';
    const clientId = process.env.FACEBOOK_APP_ID;
    
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `state=${state}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code`;

    // Store state in user's OAuth data
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.facebook.state': state,
      }
    });

    return { url: authUrl, state };
  } catch (error) {
    logger.error('Facebook OAuth URL generation error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(userId, code, state) {
  try {
    if (!isConfigured()) {
      throw new Error('Facebook OAuth not configured');
    }

    // Verify state
    const user = await User.findById(userId);
    if (!user || !user.oauth?.facebook?.state || user.oauth.facebook.state !== state) {
      throw new Error('Invalid OAuth state');
    }

    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = process.env.FACEBOOK_CALLBACK_URL || 
      `${process.env.FRONTEND_URL || 'http://localhost:5001'}/api/oauth/facebook/callback`;

    // Exchange code for short-lived token
    const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const shortLivedToken = response.data.access_token;

    // Exchange for long-lived token (60 days)
    const longLivedResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: shortLivedToken,
      },
    });

    const { access_token, expires_in } = longLivedResponse.data;

    // Get user info
    const userInfo = await getFacebookUserInfo(access_token);

    // Get user's pages
    const pages = await getFacebookPages(access_token);

    // Save tokens to user
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.facebook.accessToken': access_token,
        'oauth.facebook.connected': true,
        'oauth.facebook.connectedAt': new Date(),
        'oauth.facebook.expiresAt': expires_in 
          ? new Date(Date.now() + expires_in * 1000) 
          : null,
        'oauth.facebook.platformUserId': userInfo.id,
        'oauth.facebook.platformUsername': userInfo.name,
        'oauth.facebook.pages': pages,
      },
      $unset: {
        'oauth.facebook.state': '',
      }
    });

    logger.info('Facebook OAuth token exchange successful', { userId });

    return {
      accessToken: access_token,
      expiresIn: expires_in,
    };
  } catch (error) {
    logger.error('Facebook OAuth token exchange error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get Facebook user info
 */
async function getFacebookUserInfo(accessToken) {
  try {
    const response = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        access_token: accessToken,
        fields: 'id,name,email,picture',
      },
    });

    return {
      id: response.data.id,
      name: response.data.name,
      email: response.data.email,
      picture: response.data.picture?.data?.url,
    };
  } catch (error) {
    logger.error('Facebook user info error', { error: error.message });
    throw error;
  }
}

/**
 * Get user's Facebook pages
 */
async function getFacebookPages(accessToken) {
  try {
    const response = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        access_token: accessToken,
        fields: 'id,name,access_token',
      },
    });

    return response.data.data.map(page => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
    }));
  } catch (error) {
    logger.warn('Facebook pages fetch error', { error: error.message });
    return [];
  }
}

/**
 * Get Facebook client (for API calls)
 */
async function getFacebookClient(userId, pageId = null) {
  const user = await User.findById(userId).select('oauth.facebook');
  
  if (!user || !user.oauth?.facebook?.connected || !user.oauth.facebook.accessToken) {
    throw new Error('Facebook account not connected');
  }

  // If pageId is provided, use page access token
  if (pageId && user.oauth.facebook.pages) {
    const page = user.oauth.facebook.pages.find(p => p.id === pageId);
    if (page && page.accessToken) {
      return page.accessToken;
    }
  }

  // Check if token is expired (Facebook tokens are long-lived, but check anyway)
  if (user.oauth.facebook.expiresAt && new Date() > user.oauth.facebook.expiresAt) {
    throw new Error('Facebook token expired. Please reconnect your account.');
  }

  return user.oauth.facebook.accessToken;
}

/**
 * Post to Facebook
 */
async function postToFacebook(userId, text, options = {}, retries = 1) {
  try {
    const accessToken = await getFacebookClient(userId, options.pageId);
    const targetId = options.pageId || 'me';

    const postData = {
      message: text,
    };

    if (options.link) {
      postData.link = options.link;
    }

    if (options.imageUrl) {
      // For images, we need to use the photos endpoint
      const photoResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${targetId}/photos`,
        null,
        {
          params: {
            access_token: accessToken,
            url: options.imageUrl,
            caption: text,
          },
        }
      );

      logger.info('Facebook post successful', { userId, postId: photoResponse.data.id });
      
      return {
        id: photoResponse.data.id,
        url: photoResponse.data.post_id 
          ? `https://www.facebook.com/${photoResponse.data.post_id}` 
          : null,
        text: text,
      };
    }

    // Regular post
    const response = await retryWithBackoff(
      async () => {
        return await axios.post(
          `https://graph.facebook.com/v18.0/${targetId}/feed`,
          null,
          {
            params: {
              access_token: accessToken,
              ...postData,
            },
          }
        );
      },
      {
        maxRetries: retries,
        initialDelay: 1000,
        onRetry: (attempt, error) => {
          logger.warn('Facebook post retry', { attempt, error: error.message, userId });
        },
      }
    );

    logger.info('Facebook post successful', { userId, postId: response.data.id });
    
    return {
      id: response.data.id,
      url: `https://www.facebook.com/${response.data.id}`,
      text: text,
    };
  } catch (error) {
    logger.error('Facebook post error', { error: error.message, userId });
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      throw new Error(`Rate limit exceeded. Please try again after ${retryAfter} seconds.`);
    }
    
    throw error;
  }
}

/**
 * Disconnect Facebook account
 */
async function disconnectFacebook(userId) {
  try {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        'oauth.facebook': '',
      }
    });

    logger.info('Facebook account disconnected', { userId });
  } catch (error) {
    logger.error('Facebook disconnect error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  isConfigured,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getFacebookUserInfo,
  getFacebookPages,
  getFacebookClient,
  postToFacebook,
  disconnectFacebook,
};





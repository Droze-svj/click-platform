// Instagram OAuth Service (via Facebook Graph API)

const axios = require('axios');
const logger = require('../utils/logger');
const User = require('../models/User');
const { getFacebookClient, getFacebookPages } = require('./facebookOAuthService');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

/**
 * Check if Instagram OAuth is configured (uses Facebook)
 */
function isConfigured() {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

/**
 * Get Instagram Business accounts (requires Facebook page)
 */
async function getInstagramAccounts(userId) {
  try {
    const user = await User.findById(userId).select('oauth.facebook');
    
    if (!user || !user.oauth?.facebook?.connected) {
      throw new Error('Facebook account must be connected first for Instagram');
    }

    const accessToken = user.oauth.facebook.accessToken;
    const pages = await getFacebookPages(accessToken);
    
    const instagramAccounts = [];

    // Get Instagram Business accounts for each page
    for (const page of pages) {
      try {
        const response = await axios.get(
          `https://graph.facebook.com/v18.0/${page.id}`,
          {
            params: {
              access_token: page.accessToken,
              fields: 'instagram_business_account',
            },
          }
        );

        if (response.data.instagram_business_account) {
          const igAccountId = response.data.instagram_business_account.id;
          
          // Get Instagram account details
          const igAccount = await axios.get(
            `https://graph.facebook.com/v18.0/${igAccountId}`,
            {
              params: {
                access_token: page.accessToken,
                fields: 'id,username,profile_picture_url',
              },
            }
          );

          instagramAccounts.push({
            id: igAccountId,
            username: igAccount.data.username,
            profilePicture: igAccount.data.profile_picture_url,
            pageId: page.id,
            pageName: page.name,
            pageAccessToken: page.accessToken,
          });
        }
      } catch (error) {
        logger.warn('Instagram account fetch error for page', { 
          pageId: page.id, 
          error: error.message 
        });
      }
    }

    // Save Instagram accounts to user
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.instagram.accounts': instagramAccounts,
        'oauth.instagram.connected': instagramAccounts.length > 0,
      }
    });

    return instagramAccounts;
  } catch (error) {
    logger.error('Get Instagram accounts error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get Instagram client (access token for specific account)
 */
async function getInstagramClient(userId, instagramAccountId = null) {
  const user = await User.findById(userId).select('oauth.facebook oauth.instagram');
  
  if (!user || !user.oauth?.facebook?.connected) {
    throw new Error('Facebook account must be connected first for Instagram');
  }

  // If no account ID specified, use the first one
  if (!instagramAccountId && user.oauth?.instagram?.accounts?.length > 0) {
    instagramAccountId = user.oauth.instagram.accounts[0].id;
  }

  // Find the account and return its page access token
  if (user.oauth?.instagram?.accounts) {
    const account = user.oauth.instagram.accounts.find(
      acc => acc.id === instagramAccountId
    );
    
    if (account) {
      return {
        accountId: account.id,
        accessToken: account.pageAccessToken,
        username: account.username,
      };
    }
  }

  // Fallback: refresh accounts
  const accounts = await getInstagramAccounts(userId);
  if (accounts.length === 0) {
    throw new Error('No Instagram Business accounts found. Please connect a Facebook page with an Instagram Business account.');
  }

  const account = accounts.find(acc => acc.id === instagramAccountId) || accounts[0];
  return {
    accountId: account.id,
    accessToken: account.pageAccessToken,
    username: account.username,
  };
}

/**
 * Post image to Instagram
 */
async function postToInstagram(userId, imageUrl, caption, options = {}, retries = 1) {
  try {
    if (!imageUrl) {
      throw new Error('Image URL is required for Instagram posts');
    }

    const client = await getInstagramClient(userId, options.instagramAccountId);
    const { accountId, accessToken } = client;

    // Step 1: Create media container
    const mediaData = {
      image_url: imageUrl,
      caption: caption || '',
    };

    if (options.isCarousel && options.children) {
      // Carousel post
      mediaData.media_type = 'CAROUSEL';
      mediaData.children = options.children.join(',');
    }

    const mediaResponse = await retryWithBackoff(
      async () => {
        return await axios.post(
          `https://graph.facebook.com/v18.0/${accountId}/media`,
          null,
          {
            params: {
              access_token: accessToken,
              ...mediaData,
            },
          }
        );
      },
      {
        maxRetries: retries,
        initialDelay: 2000, // Instagram needs more time
        onRetry: (attempt, error) => {
          logger.warn('Instagram media creation retry', { 
            attempt, 
            error: error.message, 
            userId 
          });
        },
      }
    );

    const creationId = mediaResponse.data.id;

    // Step 2: Wait a bit for media to be ready (Instagram requirement)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Publish the media
    const publishResponse = await retryWithBackoff(
      async () => {
        return await axios.post(
          `https://graph.facebook.com/v18.0/${accountId}/media_publish`,
          null,
          {
            params: {
              access_token: accessToken,
              creation_id: creationId,
            },
          }
        );
      },
      {
        maxRetries: retries,
        initialDelay: 2000,
        onRetry: (attempt, error) => {
          logger.warn('Instagram publish retry', { 
            attempt, 
            error: error.message, 
            userId 
          });
        },
      }
    );

    logger.info('Instagram post successful', { 
      userId, 
      postId: publishResponse.data.id,
      accountId 
    });
    
    return {
      id: publishResponse.data.id,
      url: `https://www.instagram.com/p/${publishResponse.data.id}/`,
      caption: caption,
      imageUrl: imageUrl,
    };
  } catch (error) {
    logger.error('Instagram post error', { error: error.message, userId });
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      throw new Error(`Rate limit exceeded. Please try again after ${retryAfter} seconds.`);
    }

    // Handle specific Instagram errors
    if (error.response?.data?.error) {
      const igError = error.response.data.error;
      if (igError.code === 2207026) {
        throw new Error('Image URL is not accessible. Please ensure the image is publicly accessible.');
      }
      if (igError.code === 2207007) {
        throw new Error('Image format not supported. Please use JPG or PNG.');
      }
    }
    
    throw error;
  }
}

/**
 * Disconnect Instagram account
 */
async function disconnectInstagram(userId) {
  try {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        'oauth.instagram': '',
      }
    });

    logger.info('Instagram account disconnected', { userId });
  } catch (error) {
    logger.error('Instagram disconnect error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  isConfigured,
  getInstagramAccounts,
  getInstagramClient,
  postToInstagram,
  disconnectInstagram,
};





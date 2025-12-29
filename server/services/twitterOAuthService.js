// Twitter/X OAuth Service

const { TwitterApi } = require('twitter-api-v2');
const logger = require('../utils/logger');
const User = require('../models/User');

// Twitter API client (for OAuth flow)
let twitterClient = null;

if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
  twitterClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  });
  logger.info('✅ Twitter OAuth client initialized');
} else {
  logger.warn('⚠️ Twitter OAuth not configured. Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET');
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl(userId, callbackUrl) {
  try {
    if (!twitterClient) {
      throw new Error('Twitter OAuth not configured');
    }

    const { url, codeVerifier, state } = await twitterClient.generateOAuth2AuthLink(
      callbackUrl,
      {
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      }
    );

    // Store code verifier and state in user's session/database
    // For now, we'll store it in the user model (in production, use Redis or session store)
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.twitter.codeVerifier': codeVerifier,
        'oauth.twitter.state': state,
      }
    });

    return { url, state };
  } catch (error) {
    logger.error('Twitter OAuth URL generation error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(userId, code, state) {
  try {
    if (!twitterClient) {
      throw new Error('Twitter OAuth not configured');
    }

    // Verify state
    const user = await User.findById(userId);
    if (!user || !user.oauth?.twitter?.state || user.oauth.twitter.state !== state) {
      throw new Error('Invalid OAuth state');
    }

    const codeVerifier = user.oauth.twitter.codeVerifier;
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    // Exchange code for token
    const { client: loggedClient, accessToken, refreshToken } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: process.env.TWITTER_CALLBACK_URL || 'http://localhost:5001/api/oauth/twitter/callback',
    });

    // Save tokens to user
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.twitter.accessToken': accessToken,
        'oauth.twitter.refreshToken': refreshToken,
        'oauth.twitter.connected': true,
        'oauth.twitter.connectedAt': new Date(),
      },
      $unset: {
        'oauth.twitter.codeVerifier': '',
        'oauth.twitter.state': '',
      }
    });

    logger.info('Twitter OAuth token exchange successful', { userId });

    return {
      accessToken,
      refreshToken,
      client: loggedClient,
    };
  } catch (error) {
    logger.error('Twitter OAuth token exchange error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.oauth?.twitter?.refreshToken) {
      throw new Error('No refresh token found');
    }

    const refreshToken = user.oauth.twitter.refreshToken;

    // Create client with refresh token
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    });

    const { client: loggedClient, accessToken, refreshToken: newRefreshToken } = 
      await client.refreshOAuth2Token(refreshToken);

    // Update tokens
    await User.findByIdAndUpdate(userId, {
      $set: {
        'oauth.twitter.accessToken': accessToken,
        'oauth.twitter.refreshToken': newRefreshToken,
        'oauth.twitter.lastRefreshed': new Date(),
      }
    });

    logger.info('Twitter OAuth token refreshed', { userId });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      client: loggedClient,
    };
  } catch (error) {
    logger.error('Twitter OAuth token refresh error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get authenticated Twitter client for user
 */
async function getTwitterClient(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.oauth?.twitter?.accessToken) {
      throw new Error('Twitter not connected');
    }

    let accessToken = user.oauth.twitter.accessToken;

    // Check if token needs refresh (refresh if older than 1 hour)
    const lastRefreshed = user.oauth.twitter.lastRefreshed;
    const needsRefresh = !lastRefreshed || 
      (Date.now() - new Date(lastRefreshed).getTime()) > 60 * 60 * 1000;

    if (needsRefresh && user.oauth.twitter.refreshToken) {
      const refreshed = await refreshAccessToken(userId);
      accessToken = refreshed.accessToken;
    }

    // Create authenticated client
    const client = new TwitterApi(accessToken);
    return client;
  } catch (error) {
    logger.error('Twitter client creation error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Post tweet with retry logic
 */
async function postTweet(userId, text, options = {}, retries = 1) {
  try {
    const client = await getTwitterClient(userId);
    const tweet = await client.v2.tweet(text, options);
    
    logger.info('Tweet posted successfully', { userId, tweetId: tweet.data.id });
    return tweet.data;
  } catch (error) {
    logger.error('Tweet posting error', { error: error.message, userId, retries });
    
    // If token expired, try to refresh and retry
    if (error.code === 401 && retries > 0) {
      const user = await User.findById(userId);
      if (user?.oauth?.twitter?.refreshToken) {
        try {
          await refreshAccessToken(userId);
          logger.info('Token refreshed, retrying tweet', { userId });
          // Retry once
          return await postTweet(userId, text, options, retries - 1);
        } catch (refreshError) {
          logger.error('Token refresh failed during tweet retry', { 
            error: refreshError.message, 
            userId 
          });
          throw new Error('Token refresh failed. Please reconnect your Twitter account.');
        }
      }
    }
    
    // Handle rate limiting
    if (error.code === 429) {
      const retryAfter = error.rateLimit?.reset || 900; // Default 15 minutes
      throw new Error(`Rate limit exceeded. Please try again after ${retryAfter} seconds.`);
    }
    
    throw error;
  }
}

/**
 * Disconnect Twitter account
 */
async function disconnectTwitter(userId) {
  try {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        'oauth.twitter': '',
      }
    });

    logger.info('Twitter account disconnected', { userId });
    return { success: true };
  } catch (error) {
    logger.error('Twitter disconnect error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getTwitterClient,
  postTweet,
  disconnectTwitter,
  isConfigured: () => !!twitterClient,
};


// OAuth Connection Health Check Service

const User = require('../models/User');
const logger = require('../utils/logger');
const { getTwitterClient } = require('./twitterOAuthService');
const { getLinkedInClient, getLinkedInUserInfo } = require('./linkedinOAuthService');
const { getFacebookClient, getFacebookUserInfo } = require('./facebookOAuthService');
const { getInstagramClient } = require('./instagramOAuthService');

/**
 * Check Twitter OAuth connection health
 */
async function checkTwitterConnection(userId) {
  try {
    const user = await User.findById(userId).select('oauth.twitter');
    
    if (!user || !user.oauth?.twitter?.connected) {
      return {
        platform: 'twitter',
        connected: false,
        status: 'not_connected',
        message: 'Twitter account not connected',
      };
    }

    // Try to get client (this will test token validity)
    try {
      const client = await getTwitterClient(userId);
      // Make a simple API call to verify token
      const me = await client.v2.me();
      
      return {
        platform: 'twitter',
        connected: true,
        status: 'healthy',
        username: me.data.username,
        userId: me.data.id,
        lastChecked: new Date(),
      };
    } catch (error) {
      // Token might be expired
      if (error.code === 401) {
        return {
          platform: 'twitter',
          connected: true,
          status: 'token_expired',
          message: 'Token expired, refresh required',
          error: error.message,
        };
      }
      
      return {
        platform: 'twitter',
        connected: true,
        status: 'error',
        message: 'Connection check failed',
        error: error.message,
      };
    }
  } catch (error) {
    logger.error('Twitter connection health check error', { error: error.message, userId });
    return {
      platform: 'twitter',
      connected: false,
      status: 'error',
      message: 'Health check failed',
      error: error.message,
    };
  }
}

/**
 * Check LinkedIn OAuth connection health
 */
async function checkLinkedInConnection(userId) {
  try {
    const user = await User.findById(userId).select('oauth.linkedin');
    
    if (!user || !user.oauth?.linkedin?.connected) {
      return {
        platform: 'linkedin',
        connected: false,
        status: 'not_connected',
        message: 'LinkedIn account not connected',
      };
    }

    // Try to get client (this will test token validity)
    try {
      const accessToken = await getLinkedInClient(userId);
      const userInfo = await getLinkedInUserInfo(accessToken);
      
      return {
        platform: 'linkedin',
        connected: true,
        status: 'healthy',
        username: userInfo.name,
        userId: userInfo.id,
        lastChecked: new Date(),
      };
    } catch (error) {
      // Token might be expired
      if (error.response?.status === 401 || error.message.includes('expired')) {
        return {
          platform: 'linkedin',
          connected: true,
          status: 'token_expired',
          message: 'Token expired, refresh required',
          error: error.message,
        };
      }
      
      return {
        platform: 'linkedin',
        connected: true,
        status: 'error',
        message: 'Connection check failed',
        error: error.message,
      };
    }
  } catch (error) {
    logger.error('LinkedIn connection health check error', { error: error.message, userId });
    return {
      platform: 'linkedin',
      connected: false,
      status: 'error',
      message: 'Health check failed',
      error: error.message,
    };
  }
}

/**
 * Check Facebook OAuth connection health
 */
async function checkFacebookConnection(userId) {
  try {
    const user = await User.findById(userId).select('oauth.facebook');
    
    if (!user || !user.oauth?.facebook?.connected) {
      return {
        platform: 'facebook',
        connected: false,
        status: 'not_connected',
        message: 'Facebook account not connected',
      };
    }

    // Try to get client (this will test token validity)
    try {
      const accessToken = await getFacebookClient(userId);
      const userInfo = await getFacebookUserInfo(accessToken);
      
      return {
        platform: 'facebook',
        connected: true,
        status: 'healthy',
        username: userInfo.name,
        userId: userInfo.id,
        pagesCount: user.oauth.facebook.pages?.length || 0,
        lastChecked: new Date(),
      };
    } catch (error) {
      // Token might be expired
      if (error.response?.status === 401 || error.message.includes('expired')) {
        return {
          platform: 'facebook',
          connected: true,
          status: 'token_expired',
          message: 'Token expired, reconnect required',
          error: error.message,
        };
      }
      
      return {
        platform: 'facebook',
        connected: true,
        status: 'error',
        message: 'Connection check failed',
        error: error.message,
      };
    }
  } catch (error) {
    logger.error('Facebook connection health check error', { error: error.message, userId });
    return {
      platform: 'facebook',
      connected: false,
      status: 'error',
      message: 'Health check failed',
      error: error.message,
    };
  }
}

/**
 * Check Instagram OAuth connection health
 */
async function checkInstagramConnection(userId) {
  try {
    const user = await User.findById(userId).select('oauth.instagram oauth.facebook');
    
    if (!user || !user.oauth?.facebook?.connected) {
      return {
        platform: 'instagram',
        connected: false,
        status: 'not_connected',
        message: 'Facebook account must be connected first for Instagram',
      };
    }

    if (!user.oauth?.instagram?.connected || !user.oauth.instagram.accounts?.length) {
      return {
        platform: 'instagram',
        connected: false,
        status: 'not_connected',
        message: 'No Instagram Business accounts found',
      };
    }

    // Try to get client (this will test token validity)
    try {
      const client = await getInstagramClient(userId);
      
      return {
        platform: 'instagram',
        connected: true,
        status: 'healthy',
        username: client.username,
        accountId: client.accountId,
        accountsCount: user.oauth.instagram.accounts.length,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        platform: 'instagram',
        connected: true,
        status: 'error',
        message: 'Connection check failed',
        error: error.message,
      };
    }
  } catch (error) {
    logger.error('Instagram connection health check error', { error: error.message, userId });
    return {
      platform: 'instagram',
      connected: false,
      status: 'error',
      message: 'Health check failed',
      error: error.message,
    };
  }
}

/**
 * Check all OAuth connections for a user
 */
async function checkAllConnections(userId) {
  const results = {
    userId,
    timestamp: new Date(),
    connections: {},
  };

  // Check Twitter
  results.connections.twitter = await checkTwitterConnection(userId);

  // Check LinkedIn
  results.connections.linkedin = await checkLinkedInConnection(userId);

  // Check Facebook
  results.connections.facebook = await checkFacebookConnection(userId);

  // Check Instagram
  results.connections.instagram = await checkInstagramConnection(userId);

  // Calculate overall health
  const connectedCount = Object.values(results.connections).filter(c => c.connected).length;
  const healthyCount = Object.values(results.connections).filter(c => c.status === 'healthy').length;
  
  results.summary = {
    total: Object.keys(results.connections).length,
    connected: connectedCount,
    healthy: healthyCount,
    overall: healthyCount === connectedCount && connectedCount > 0 ? 'healthy' : 'degraded',
  };

  return results;
}

/**
 * Refresh expired tokens automatically
 */
async function refreshExpiredTokens(userId) {
  const results = {
    refreshed: [],
    failed: [],
  };

  try {
    const user = await User.findById(userId).select('oauth');
    
    // Check Twitter
    if (user?.oauth?.twitter?.connected && user.oauth.twitter.refreshToken) {
      const health = await checkTwitterConnection(userId);
      if (health.status === 'token_expired') {
        try {
          const { refreshAccessToken } = require('./twitterOAuthService');
          await refreshAccessToken(userId);
          results.refreshed.push('twitter');
          logger.info('Twitter token refreshed automatically', { userId });
        } catch (error) {
          results.failed.push({ platform: 'twitter', error: error.message });
          logger.error('Twitter token refresh failed', { error: error.message, userId });
        }
      }
    }

    // Check LinkedIn
    if (user?.oauth?.linkedin?.connected && user.oauth.linkedin.refreshToken) {
      const health = await checkLinkedInConnection(userId);
      if (health.status === 'token_expired') {
        try {
          const { refreshAccessToken } = require('./linkedinOAuthService');
          await refreshAccessToken(userId);
          results.refreshed.push('linkedin');
          logger.info('LinkedIn token refreshed automatically', { userId });
        } catch (error) {
          results.failed.push({ platform: 'linkedin', error: error.message });
          logger.error('LinkedIn token refresh failed', { error: error.message, userId });
        }
      }
    }
  } catch (error) {
    logger.error('Token refresh error', { error: error.message, userId });
  }

  return results;
}

module.exports = {
  checkTwitterConnection,
  checkLinkedInConnection,
  checkFacebookConnection,
  checkInstagramConnection,
  checkAllConnections,
  refreshExpiredTokens,
};



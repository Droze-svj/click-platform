// Automatic token refresh service for social media connections

const SocialConnection = require('../models/SocialConnection');
const { refreshTwitterToken } = require('./oauthService');
const { refreshWithRefreshToken: refreshLinkedInWithToken } = require('./linkedinOAuthService');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Refresh token for a social connection if needed
 */
async function refreshTokenIfNeeded(connection) {
  try {
    // Check if token expires soon (within 1 hour)
    const expiresAt = connection.metadata?.expiresAt;
    if (!expiresAt) {
      return connection; // No expiration info, assume valid
    }

    const expiresIn = new Date(expiresAt) - new Date();
    const oneHour = 60 * 60 * 1000;

    // If expires in less than 1 hour, refresh it
    if (expiresIn < oneHour) {
      logger.info('Refreshing token', { platform: connection.platform, userId: connection.userId });

      let newTokenData;
      switch (connection.platform.toLowerCase()) {
        case 'twitter':
          if (connection.refreshToken) {
            newTokenData = await refreshTwitterToken(connection.refreshToken);
            break;
          }
          // No refresh token, can't refresh
          logger.warn('No refresh token available for Twitter', { connectionId: connection._id });
          return connection;

        case 'linkedin':
          try {
            newTokenData = await refreshLinkedInWithToken(connection.refreshToken);
            newTokenData.expiresIn = newTokenData.expiresIn ?? 5184000; // LinkedIn default ~60 days in seconds
          } catch (err) {
            logger.warn('LinkedIn token refresh failed', { connectionId: connection._id, error: err.message });
            return connection;
          }
          break;

        case 'facebook':
        case 'instagram':
          // Facebook tokens are long-lived, may not need refresh
          // But if they do expire, would need to re-authenticate
          logger.info('Facebook token is long-lived, no refresh needed');
          return connection;

        default:
          logger.warn('Unknown platform for token refresh', { platform: connection.platform });
          return connection;
      }

      // Update connection with new tokens
      connection.accessToken = newTokenData.accessToken;
      if (newTokenData.refreshToken) {
        connection.refreshToken = newTokenData.refreshToken;
      }
      if (newTokenData.expiresIn) {
        connection.metadata = {
          ...connection.metadata,
          expiresAt: new Date(Date.now() + newTokenData.expiresIn * 1000),
        };
      }
      connection.lastRefreshed = new Date();
      await connection.save();

      logger.info('Token refreshed successfully', { platform: connection.platform, userId: connection.userId });
      return connection;
    }

    return connection; // Token still valid
  } catch (error) {
    logger.error('Token refresh error', {
      error: error.message,
      platform: connection.platform,
      userId: connection.userId,
    });
    captureException(error, {
      tags: { service: 'token_refresh', platform: connection.platform },
      extra: { connectionId: connection._id },
    });
    return connection; // Return original connection on error
  }
}

/**
 * Refresh all tokens that need refreshing
 */
async function refreshAllTokens() {
  try {
    const connections = await SocialConnection.find({
      isActive: true,
      refreshToken: { $exists: true, $ne: null },
    });

    logger.info('Checking tokens for refresh', { count: connections.length });

    let refreshed = 0;
    let failed = 0;

    for (const connection of connections) {
      try {
        const beforeToken = connection.accessToken;
        await refreshTokenIfNeeded(connection);
        if (connection.accessToken !== beforeToken) {
          refreshed++;
        }
      } catch (error) {
        failed++;
        logger.error('Failed to refresh token for connection', {
          connectionId: connection._id,
          platform: connection.platform,
          error: error.message,
        });
      }
    }

    logger.info('Token refresh complete', { refreshed, failed, total: connections.length });
    return { refreshed, failed, total: connections.length };
  } catch (error) {
    logger.error('Token refresh batch error', { error: error.message });
    captureException(error, { tags: { service: 'token_refresh', operation: 'batch' } });
    throw error;
  }
}

/**
 * Get valid access token (refresh if needed)
 */
async function getValidAccessToken(userId, platform) {
  try {
    const connection = await SocialConnection.findOne({
      userId,
      platform: platform.toLowerCase(),
      isActive: true,
    });

    if (!connection) {
      throw new Error(`No active connection found for ${platform}`);
    }

    // Refresh if needed
    const refreshed = await refreshTokenIfNeeded(connection);

    return refreshed.accessToken;
  } catch (error) {
    logger.error('Get valid access token error', {
      error: error.message,
      userId,
      platform,
    });
    throw error;
  }
}

module.exports = {
  refreshTokenIfNeeded,
  refreshAllTokens,
  getValidAccessToken,
};







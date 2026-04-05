/**
 * Unified Token Refresh Service
 * Handles automated background refresh for all social platforms stored on the User model.
 */

const cron = require('node-cron');
const User = require('../models/User');
const logger = require('../utils/logger');
const youtubeOAuth = require('./youtubeOAuthService');
const twitterOAuth = require('./twitterOAuthService');
// Add other services as they are finalized (linkedin, facebook, etc.)

const LOG_CONTEXT = { service: 'token-refresh' };

/**
 * Refresh tokens for a specific platform across all users
 */
async function refreshPlatformTokens(platform) {
  const platformKey = platform.toLowerCase();
  const service = platformKey === 'youtube' ? youtubeOAuth : (platformKey === 'twitter' ? twitterOAuth : null);

  if (!service || !service.refreshAccessToken) {
    logger.debug(`Skipping refresh for ${platform}: service not capable`, LOG_CONTEXT);
    return;
  }

  try {
    // Find users who have this platform connected and a refresh token
    const query = {
      [`oauth.${platformKey}.connected`]: true,
      [`oauth.${platformKey}.refreshToken`]: { $exists: true, $ne: null }
    };

    const users = await User.find(query);
    logger.info(`Checking ${users.length} ${platform} connections for refresh`, LOG_CONTEXT);

    let refreshed = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const oauthData = user.oauth[platformKey];
        const expiresAt = oauthData.expiresAt ? new Date(oauthData.expiresAt).getTime() : null;

        // If expires in less than 30 minutes, or no expiry info (safeguard)
        const shouldRefresh = !expiresAt || (expiresAt - Date.now() < 30 * 60 * 1000);

        if (shouldRefresh) {
          logger.debug(`Refreshing ${platform} token for user ${user._id}`, LOG_CONTEXT);
          await service.refreshAccessToken(user._id);
          refreshed++;
        }
      } catch (err) {
        failed++;
        logger.error(`Failed to refresh ${platform} token for user ${user._id}`, { error: err.message, ...LOG_CONTEXT });
      }
    }

    if (refreshed > 0 || failed > 0) {
      logger.info(`${platform} refresh cycle complete`, { refreshed, failed, total: users.length, ...LOG_CONTEXT });
    }
  } catch (error) {
    logger.error(`Error in ${platform} refresh cycle`, { error: error.message, ...LOG_CONTEXT });
  }
}

/**
 * Main entry point for the background refresh job
 */
async function runRefreshCycle() {
  logger.info('🎯 Starting global token refresh cycle', LOG_CONTEXT);
  
  const platforms = ['youtube', 'twitter']; // Expand as needed
  
  for (const platform of platforms) {
    await refreshPlatformTokens(platform);
  }
}

/**
 * Initialize the scheduled tasks
 */
function initScheduler() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runRefreshCycle().catch(err => {
      logger.error('Token refresh job failed', { error: err.message, ...LOG_CONTEXT });
    });
  });

  // Run once on startup after a short delay
  setTimeout(() => {
    runRefreshCycle().catch(() => {});
  }, 30000); // 30 second delay after startup

  logger.info('📅 Token refresh scheduler initialized (hourly)', LOG_CONTEXT);
}

module.exports = {
  refreshPlatformTokens,
  runRefreshCycle,
  initScheduler
};

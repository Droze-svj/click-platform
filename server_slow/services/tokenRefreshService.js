/**
 * Token Refresh Service
 * Background worker to proactively rotate social media OAuth tokens
 */

const User = require('../models/User');
const logger = require('../utils/logger');
const twitterService = require('./twitterOAuthService');
const linkedinService = require('./linkedinOAuthService');
const facebookService = require('./facebookOAuthService');
const instagramService = require('./instagramOAuthService');
const tiktokService = require('./tiktokOAuthService');
const youtubeService = require('./youtubeOAuthService');

const platforms = [
  { name: 'twitter', service: twitterService, method: 'refreshToken' },
  { name: 'linkedin', service: linkedinService, method: 'refreshAccessToken' },
  { name: 'facebook', service: facebookService, method: 'refreshAccessToken' },
  { name: 'instagram', service: instagramService, method: 'refreshAccessToken' },
  { name: 'tiktok', service: tiktokService, method: 'refreshAccessToken' },
  { name: 'youtube', service: youtubeService, method: 'refreshAccessToken' }
];

const { retryWithBackoff } = require('../utils/retryWithBackoff');
const notificationService = require('./notificationService');

/**
 * Scan all users and refresh tokens that are close to expiring
 */
async function refreshExpiringTokens() {
  logger.info('Starting proactive token refresh scan...');
  
  const now = new Date();
  const refreshWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); 

  try {
    // Find users requiring rotation for any platform
    const users = await User.find({
      $or: platforms.map(p => ({
        [`oauth.${p.name}.expiresAt`]: { $lte: refreshWindow },
        [`oauth.${p.name}.connected`]: true
      }))
    });

    logger.info(`Found ${users.length} users requiring token rotation checks.`);

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      for (const p of platforms) {
        const oauth = user.oauth?.[p.name];
        
        if (oauth?.connected && oauth?.expiresAt <= refreshWindow) {
          try {
            logger.info(`Rotating ${p.name} token for user ${user._id}`);
            
            // Apply retry logic with exponential backoff
            await retryWithBackoff(async () => {
              await p.service[p.method](user._id);
            }, {
              maxRetries: 3,
              initialDelay: 2000,
              onRetry: (attempt) => logger.warn(`Retrying ${p.name} refresh for user ${user._id} (Attempt ${attempt})`)
            });

            successCount++;
          } catch (err) {
            logger.error(`Failed to rotate ${p.name} token for user ${user._id} after retries`, { error: err.message });
            failCount++;

            // Notify user about connection issue
            try {
              await notificationService.createNotification(
                user._id,
                `${p.name.charAt(0).toUpperCase() + p.name.slice(1)} Connection Issue`,
                `We were unable to automatically refresh your ${p.name} connection. Please reconnect your account to ensure continued posting access.`,
                'warning',
                '/dashboard/social',
                { category: 'system', priority: 'high', data: { platform: p.name } }
              );
              
              // Mark as remediation required
              await User.updateOne(
                { _id: user._id },
                { $set: { [`oauth.${p.name}.status`]: 'remediation_required', [`oauth.${p.name}.lastError`]: err.message } }
              );
            } catch (notifyErr) {
              logger.error('Failed to send refresh failure notification', { userId: user._id, error: notifyErr.message });
            }
          }
        }
      }
    }

    logger.info('Proactive token refresh scan complete.', { successCount, failCount });
    return { successCount, failCount };
  } catch (error) {
    logger.error('Error during proactive token refresh scan', { error: error.message });
    throw error;
  }
}

/**
 * Initialize the scheduler
 * This is called by the main server index to ensure background rotation is active
 */
function initScheduler() {
  logger.info('Initializing Token Refresh Scheduler...');
  // The actual scheduling is handled by the worker if using BullMQ,
  // but we can also trigger a one-time check here on boot.
  refreshExpiringTokens().catch(err => {
    logger.error('Initial token refresh check failed', { error: err.message });
  });
}

module.exports = {
  refreshExpiringTokens,
  initScheduler
};

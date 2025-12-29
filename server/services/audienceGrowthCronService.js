// Audience Growth Cron Service
// Automatic daily audience growth syncing

const cron = require('node-cron');
const { syncAllPlatformsAudienceGrowth } = require('./audienceGrowthSyncService');
const SocialConnection = require('../models/SocialConnection');
const logger = require('../utils/logger');

let audienceGrowthJob = null;

/**
 * Start daily audience growth sync
 * Runs daily at 3 AM
 */
function startAudienceGrowthCron() {
  if (audienceGrowthJob) {
    logger.warn('Audience growth cron already started');
    return;
  }

  audienceGrowthJob = cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Running daily audience growth sync');

      // Get all users with active social connections
      const connections = await SocialConnection.find({ isActive: true })
        .select('userId')
        .lean();

      const userIds = [...new Set(connections.map(c => c.userId.toString()))];

      let successful = 0;
      let failed = 0;

      for (const userId of userIds) {
        try {
          const result = await syncAllPlatformsAudienceGrowth(userId);
          successful += result.successful;
          failed += result.failed;
        } catch (error) {
          failed++;
          logger.warn('Error syncing audience growth for user', {
            userId,
            error: error.message
          });
        }
      }

      logger.info('Daily audience growth sync completed', {
        usersProcessed: userIds.length,
        successful,
        failed
      });
    } catch (error) {
      logger.error('Error in audience growth cron', { error: error.message });
    }
  });

  logger.info('Audience growth cron started (daily at 3 AM)');
}

/**
 * Stop audience growth cron
 */
function stopAudienceGrowthCron() {
  if (audienceGrowthJob) {
    audienceGrowthJob.stop();
    audienceGrowthJob = null;
    logger.info('Audience growth cron stopped');
  }
}

module.exports = {
  startAudienceGrowthCron,
  stopAudienceGrowthCron
};



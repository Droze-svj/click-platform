// Compliance Cron Service
// Automated data retention and compliance enforcement

const cron = require('node-cron');
const { enforceDataRetention } = require('./complianceService');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

let retentionJob = null;

/**
 * Start data retention enforcement cron job
 * Runs daily at 3 AM
 */
function startRetentionCron() {
  if (retentionJob) {
    logger.warn('Retention cron already started');
    return;
  }

  // Run daily at 3 AM
  retentionJob = cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Running daily data retention enforcement');

      // Only workspaces that actually configured a retention policy, paginated so
      // a large tenant base isn't loaded into memory at once (mirrors tokenRefreshCron).
      const PAGE = 500;
      let processed = 0;
      for (let skip = 0; ; skip += PAGE) {
        const workspaces = await Workspace.find({ 'settings.sla.dataRetention': { $exists: true, $ne: null } })
          .select('_id settings.sla.dataRetention')
          .skip(skip)
          .limit(PAGE)
          .lean();
        if (!workspaces.length) break;

        for (const workspace of workspaces) {
          try {
            if (workspace.settings?.sla?.dataRetention) {
              await enforceDataRetention(workspace._id);
              processed += 1;
            }
          } catch (error) {
            logger.warn('Error enforcing retention for workspace', {
              workspaceId: workspace._id,
              error: error.message
            });
          }
        }
        if (workspaces.length < PAGE) break;
      }
      logger.info('Data retention enforcement: workspaces processed', { processed });

      logger.info('Data retention enforcement completed');
    } catch (error) {
      logger.error('Error in retention cron', { error: error.message });
    }
  });

  logger.info('Data retention cron started');
}

/**
 * Stop retention cron
 */
function stopRetentionCron() {
  if (retentionJob) {
    retentionJob.stop();
    retentionJob = null;
    logger.info('Retention cron stopped');
  }
}

module.exports = {
  startRetentionCron,
  stopRetentionCron
};

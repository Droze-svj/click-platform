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

      // Get all workspaces
      const workspaces = await Workspace.find({}).select('_id settings.sla.dataRetention').lean();

      for (const workspace of workspaces) {
        try {
          if (workspace.settings?.sla?.dataRetention) {
            await enforceDataRetention(workspace._id);
          }
        } catch (error) {
          logger.warn('Error enforcing retention for workspace', {
            workspaceId: workspace._id,
            error: error.message
          });
        }
      }

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

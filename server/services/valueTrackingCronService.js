// Value Tracking Cron Service
// Automated monthly calculations and tier checks

const cron = require('node-cron');
const { autoCalculateMonthlyTracking } = require('./automatedValueTrackingService');
const { checkTierUsageAndAlert } = require('./tierManagementService');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

let monthlyCalculationJob = null;
let tierCheckJob = null;

/**
 * Start monthly value tracking calculation
 * Runs on the 1st of each month at 2 AM
 */
function startMonthlyCalculationCron() {
  if (monthlyCalculationJob) {
    logger.warn('Monthly calculation cron already started');
    return;
  }

  monthlyCalculationJob = cron.schedule('0 2 1 * *', async () => {
    try {
      logger.info('Running monthly value tracking calculation');

      // Get all agencies
      const agencies = await Workspace.find({ type: 'agency' }).lean();

      for (const agency of agencies) {
        try {
          await autoCalculateMonthlyTracking(agency._id);
        } catch (error) {
          logger.warn('Error calculating monthly tracking for agency', {
            agencyId: agency._id,
            error: error.message
          });
        }
      }

      logger.info('Monthly value tracking calculation completed');
    } catch (error) {
      logger.error('Error in monthly calculation cron', { error: error.message });
    }
  });

  logger.info('Monthly value tracking calculation cron started');
}

/**
 * Start tier usage check
 * Runs weekly on Monday at 9 AM
 */
function startTierCheckCron() {
  if (tierCheckJob) {
    logger.warn('Tier check cron already started');
    return;
  }

  tierCheckJob = cron.schedule('0 9 * * 1', async () => {
    try {
      logger.info('Running tier usage check');

      // Get all client tier assignments
      const ClientServiceTier = require('../models/ClientServiceTier');
      const assignments = await ClientServiceTier.find({ status: 'active' }).lean();

      for (const assignment of assignments) {
        try {
          await checkTierUsageAndAlert(assignment.clientWorkspaceId);
        } catch (error) {
          logger.warn('Error checking tier usage for client', {
            clientWorkspaceId: assignment.clientWorkspaceId,
            error: error.message
          });
        }
      }

      logger.info('Tier usage check completed', { checked: assignments.length });
    } catch (error) {
      logger.error('Error in tier check cron', { error: error.message });
    }
  });

  logger.info('Tier usage check cron started');
}

/**
 * Stop all cron jobs
 */
function stopAllCronJobs() {
  if (monthlyCalculationJob) {
    monthlyCalculationJob.stop();
    monthlyCalculationJob = null;
  }
  if (tierCheckJob) {
    tierCheckJob.stop();
    tierCheckJob = null;
  }
  logger.info('Value tracking cron jobs stopped');
}

module.exports = {
  startMonthlyCalculationCron,
  startTierCheckCron,
  stopAllCronJobs
};



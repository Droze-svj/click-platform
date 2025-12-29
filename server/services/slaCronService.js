// SLA Cron Service
// Periodic SLA status checking and escalation

const cron = require('node-cron');
const ApprovalSLA = require('../models/ApprovalSLA');
const { checkSLAStatus } = require('./slaTrackingService');
const logger = require('../utils/logger');

let cronJob = null;

/**
 * Start SLA monitoring cron job
 * Runs every 15 minutes to check SLA status
 */
function startSLAMonitoring() {
  if (cronJob) {
    logger.warn('SLA monitoring already started');
    return;
  }

  // Run every 15 minutes
  cronJob = cron.schedule('*/15 * * * *', async () => {
    try {
      logger.debug('Running SLA status check');

      // Get all active SLAs
      const slas = await ApprovalSLA.find({
        status: { $in: ['on_time', 'at_risk', 'overdue'] },
        completedAt: null
      }).select('approvalId').lean();

      const approvalIds = [...new Set(slas.map(s => s.approvalId.toString()))];

      // Check each approval's SLA
      for (const approvalId of approvalIds) {
        try {
          await checkSLAStatus(approvalId);
        } catch (error) {
          logger.warn('Error checking SLA for approval', { approvalId, error: error.message });
        }
      }

      logger.debug('SLA status check completed', { checked: approvalIds.length });
    } catch (error) {
      logger.error('Error in SLA monitoring cron', { error: error.message });
    }
  });

  logger.info('SLA monitoring started');
}

/**
 * Stop SLA monitoring
 */
function stopSLAMonitoring() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('SLA monitoring stopped');
  }
}

module.exports = {
  startSLAMonitoring,
  stopSLAMonitoring
};



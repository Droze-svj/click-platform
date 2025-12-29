// Export Notification Service
// Notify users about export status

const ExportJob = require('../models/ExportJob');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Send export notification
 */
async function sendExportNotification(jobId, type) {
  try {
    const job = await ExportJob.findById(jobId).populate('userId').lean();
    if (!job) {
      throw new Error('Export job not found');
    }

    const user = job.userId;
    const notification = {
      type: 'export',
      exportType: type,
      jobId: job._id,
      status: job.status,
      message: getNotificationMessage(job, type),
      actionUrl: `/dashboard/exports/${job._id}`
    };

    // Send notification (would integrate with notification service)
    await sendNotification(user._id, notification);

    logger.info('Export notification sent', { jobId, type, userId: user._id });
  } catch (error) {
    logger.error('Error sending export notification', { error: error.message, jobId });
  }
}

/**
 * Get notification message
 */
function getNotificationMessage(job, type) {
  switch (type) {
    case 'started':
      return `Your ${job.export.type} export has started processing.`;
    case 'completed':
      return `Your ${job.export.type} export is ready! Download it here.`;
    case 'failed':
      return `Your ${job.export.type} export failed. ${job.error?.message || 'Please try again.'}`;
    case 'retry':
      return `Your ${job.export.type} export is being retried automatically.`;
    default:
      return `Your export status has been updated.`;
  }
}

/**
 * Send notification (placeholder)
 */
async function sendNotification(userId, notification) {
  // Would integrate with notification service
  // Could be email, push, in-app, etc.
  logger.info('Notification sent', { userId, notification });
}

/**
 * Notify on export events
 */
async function notifyExportEvent(jobId, event) {
  try {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      return;
    }

    switch (event) {
      case 'started':
        await sendExportNotification(jobId, 'started');
        break;
      case 'completed':
        await sendExportNotification(jobId, 'completed');
        break;
      case 'failed':
        await sendExportNotification(jobId, 'failed');
        break;
      case 'retry':
        await sendExportNotification(jobId, 'retry');
        break;
    }
  } catch (error) {
    logger.error('Error notifying export event', { error: error.message, jobId });
  }
}

module.exports = {
  sendExportNotification,
  notifyExportEvent
};



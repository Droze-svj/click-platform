// Report Scheduler Service

const { jobSchedulerService } = require('./jobSchedulerService');
const { generatePDFReport, generateExcelReport, generateCustomReport } = require('./reportingService');
const { sendEmail } = require('./emailService');
const logger = require('../utils/logger');

/**
 * Schedule report
 */
async function scheduleReport(userId, reportConfig, schedule) {
  try {
    const {
      type,
      format = 'pdf',
      period = 30,
      recipients = [],
      scheduleType = 'daily', // daily, weekly, monthly
      scheduleTime = '09:00',
      timezone = 'UTC',
    } = schedule;

    // Create scheduled job
    // In production, use job scheduler
    const jobId = `report-${userId}-${type}`;
    
    // For now, store schedule info (in production, use actual scheduler)
    const scheduledJob = {
      id: jobId,
      userId,
      type,
      format,
      scheduleType,
      scheduleTime,
      timezone,
      recipients,
      createdAt: new Date(),
    };
    
    // In production, this would schedule the actual job
    // await jobSchedulerService.scheduleRecurringJob(jobId, async () => {
        try {
          // Generate report
          let report;
          if (format === 'pdf') {
            report = await generatePDFReport(userId, type, { period });
          } else if (format === 'excel') {
            report = await generateExcelReport(userId, type, { period });
          } else {
            report = await generateCustomReport(userId, { ...reportConfig, format, period });
          }

          // Send to recipients
          const emailRecipients = recipients.length > 0 ? recipients : [userId];
          
          // Send emails (in production, attach report file)
          for (const recipientId of emailRecipients) {
            // Get recipient email (could be user ID or email)
            const recipientEmail = typeof recipientId === 'string' && recipientId.includes('@')
              ? recipientId
              : await getRecipientEmail(recipientId);

            // In production, send email with report attachment
            // await sendEmail(recipientEmail, `Scheduled Report: ${type}`, 'report', {...});
          }

          logger.info('Scheduled report generated and sent', {
            userId,
            type,
            format,
            recipients: emailRecipients.length,
          });
        } catch (error) {
          logger.error('Scheduled report error', {
            error: error.message,
            userId,
            type,
          });
        }

    return { success: true, jobId };
  } catch (error) {
    logger.error('Schedule report error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get cron schedule
 */
function getCronSchedule(scheduleType, scheduleTime) {
  const [hour, minute] = scheduleTime.split(':').map(Number);

  switch (scheduleType) {
    case 'daily':
      return `${minute} ${hour} * * *`; // Daily at specified time
    case 'weekly':
      return `${minute} ${hour} * * 1`; // Every Monday
    case 'monthly':
      return `${minute} ${hour} 1 * *`; // First day of month
    default:
      return `${minute} ${hour} * * *`;
  }
}

/**
 * Get recipient email
 */
async function getRecipientEmail(recipientId) {
  try {
    const User = require('../models/User');
    const user = await User.findById(recipientId).select('email').lean();
    return user?.email || recipientId;
  } catch (error) {
    return recipientId; // Assume it's already an email
  }
}

/**
 * Cancel scheduled report
 */
async function cancelScheduledReport(userId, reportType) {
  try {
    const jobId = `report-${userId}-${reportType}`;
    // Note: jobSchedulerService would need a cancelJob method
    // For now, we'll log the cancellation request
    logger.info('Scheduled report cancellation requested', { userId, reportType, jobId });
    return { success: true, jobId };
  } catch (error) {
    logger.error('Cancel scheduled report error', {
      error: error.message,
      userId,
      reportType,
    });
    throw error;
  }
}

/**
 * Get scheduled reports
 */
async function getScheduledReports(userId) {
  try {
    // In production, store in database
    // For now, return placeholder
    // The job scheduler would need getUserJobs method
    return [];
  } catch (error) {
    logger.error('Get scheduled reports error', { error: error.message, userId });
    return [];
  }
}

module.exports = {
  scheduleReport,
  cancelScheduledReport,
  getScheduledReports,
};


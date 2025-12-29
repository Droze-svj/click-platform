// Scheduled Report Service
// Automated report generation and delivery

const ScheduledReport = require('../models/ScheduledReport');
const { generateReport } = require('./reportBuilderService');
const { generateReportSummary } = require('./aiReportSummaryService');
const GeneratedReport = require('../models/GeneratedReport');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

/**
 * Create scheduled report
 */
async function createScheduledReport(scheduleData) {
  try {
    const scheduledReport = new ScheduledReport(scheduleData);
    await scheduledReport.save();

    logger.info('Scheduled report created', { scheduledReportId: scheduledReport._id });
    return scheduledReport;
  } catch (error) {
    logger.error('Error creating scheduled report', { error: error.message });
    throw error;
  }
}

/**
 * Process scheduled reports (run by cron)
 */
async function processScheduledReports() {
  try {
    const now = new Date();
    
    // Find reports due for generation
    const dueReports = await ScheduledReport.find({
      isActive: true,
      nextGeneration: { $lte: now }
    }).populate('templateId').lean();

    logger.info('Processing scheduled reports', { count: dueReports.length });

    for (const scheduled of dueReports) {
      try {
        await generateAndDeliverReport(scheduled);
        
        // Update next generation time
        const nextGen = calculateNextGeneration(scheduled.schedule);
        await ScheduledReport.findByIdAndUpdate(scheduled._id, {
          lastGenerated: now,
          nextGeneration: nextGen,
          $inc: { generationCount: 1 }
        });
      } catch (error) {
        logger.error('Error processing scheduled report', {
          scheduledReportId: scheduled._id,
          error: error.message
        });
      }
    }

    return { processed: dueReports.length };
  } catch (error) {
    logger.error('Error processing scheduled reports', { error: error.message });
    throw error;
  }
}

/**
 * Generate and deliver report
 */
async function generateAndDeliverReport(scheduled) {
  // Calculate period
  const period = calculatePeriod(scheduled.periodConfig);

  // Generate report
  const report = await generateReport(
    scheduled.templateId._id,
    period,
    scheduled.clientWorkspaceId,
    scheduled.agencyWorkspaceId,
    scheduled.createdBy
  );

  // Generate AI summary if enabled
  if (scheduled.templateId.aiSummary?.enabled) {
    const summary = await generateReportSummary(report, scheduled.templateId.aiSummary);
    report.aiSummary = summary;
    await report.save();
  }

  // Deliver report
  if (scheduled.delivery.email?.enabled) {
    await deliverViaEmail(report, scheduled);
  }

  if (scheduled.delivery.portal?.enabled) {
    await deliverViaPortal(report, scheduled);
  }

  if (scheduled.delivery.webhook?.enabled) {
    await deliverViaWebhook(report, scheduled);
  }

  logger.info('Report generated and delivered', { reportId: report._id });
  return report;
}

/**
 * Calculate period based on config
 */
function calculatePeriod(periodConfig) {
  const now = new Date();
  let startDate, endDate;

  switch (periodConfig.type) {
    case 'last_period':
      // Last 30 days
      endDate = now;
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'rolling':
      endDate = now;
      startDate = new Date(now.getTime() - periodConfig.days * 24 * 60 * 60 * 1000);
      break;
    case 'custom':
      startDate = periodConfig.customStart;
      endDate = periodConfig.customEnd;
      break;
  }

  return {
    startDate,
    endDate,
    type: 'custom'
  };
}

/**
 * Calculate next generation time
 */
function calculateNextGeneration(schedule) {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);
  
  let next = new Date();
  next.setHours(hours, minutes, 0, 0);
  
  switch (schedule.frequency) {
    case 'daily':
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'weekly':
      const dayDiff = schedule.dayOfWeek - next.getDay();
      if (dayDiff < 0 || (dayDiff === 0 && next <= now)) {
        next.setDate(next.getDate() + (7 + dayDiff));
      } else {
        next.setDate(next.getDate() + dayDiff);
      }
      break;
    case 'monthly':
      next.setDate(schedule.dayOfMonth || 1);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }
  
  return next;
}

/**
 * Deliver report via email
 */
async function deliverViaEmail(report, scheduled) {
  try {
    const transporter = nodemailer.createTransport({
      // Email configuration
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const reportUrl = `${process.env.APP_URL}/reports/${report._id}`;
    
    for (const recipient of scheduled.delivery.email.recipients) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: recipient,
        subject: `Report: ${report.templateId?.name || 'Monthly Report'}`,
        html: `
          <h2>Your Report is Ready</h2>
          <p>View your report: <a href="${reportUrl}">${reportUrl}</a></p>
          ${report.aiSummary ? `<p>${report.aiSummary.text}</p>` : ''}
        `
      });
    }

    logger.info('Report delivered via email', { reportId: report._id });
  } catch (error) {
    logger.error('Error delivering report via email', { error: error.message });
  }
}

/**
 * Deliver report via portal
 */
async function deliverViaPortal(report, scheduled) {
  // Would create notification in portal
  logger.info('Report delivered via portal', { reportId: report._id });
}

/**
 * Deliver report via webhook
 */
async function deliverViaWebhook(report, scheduled) {
  try {
    const axios = require('axios');
    await axios.post(scheduled.delivery.webhook.url, {
      reportId: report._id,
      reportUrl: `${process.env.APP_URL}/reports/${report._id}`,
      data: report.data
    }, {
      headers: {
        'X-Webhook-Secret': scheduled.delivery.webhook.secret
      }
    });

    logger.info('Report delivered via webhook', { reportId: report._id });
  } catch (error) {
    logger.error('Error delivering report via webhook', { error: error.message });
  }
}

module.exports = {
  createScheduledReport,
  processScheduledReports
};



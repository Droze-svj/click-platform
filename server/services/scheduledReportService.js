// Scheduled Report Service
// Automated report generation and delivery

const ScheduledReport = require('../models/ScheduledReport');
const { generateReport } = require('./reportBuilderService');
const { generateReportSummary } = require('./aiReportSummaryService');
const GeneratedReport = require('../models/GeneratedReport');
const Workspace = require('../models/Workspace');
const { sendEmail } = require('./emailService');
const logger = require('../utils/logger');

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
        // Advance nextGeneration even on failure so a persistently-broken report
        // retries at its NEXT scheduled slot, not on every hourly cron tick.
        try {
          await ScheduledReport.findByIdAndUpdate(scheduled._id, {
            nextGeneration: calculateNextGeneration(scheduled.schedule),
            lastError: error.message,
          });
        } catch (e) {
          logger.error('Failed to advance nextGeneration after report error', { error: e.message });
        }
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
function calculatePeriod(periodConfig = {}) {
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  let startDate, endDate;

  switch (periodConfig && periodConfig.type) {
  case 'rolling':
    endDate = now;
    startDate = new Date(now.getTime() - (Number(periodConfig.days) || 30) * DAY);
    break;
  case 'custom':
    startDate = periodConfig.customStart ? new Date(periodConfig.customStart) : null;
    endDate = periodConfig.customEnd ? new Date(periodConfig.customEnd) : null;
    break;
  case 'last_period':
  default:
    // Last 30 days
    endDate = now;
    startDate = new Date(now.getTime() - 30 * DAY);
  }

  // Fail-safe: GeneratedReport.period requires both bounds — never return undefined.
  if (!startDate || isNaN(startDate.getTime())) startDate = new Date(now.getTime() - 30 * DAY);
  if (!endDate || isNaN(endDate.getTime())) endDate = now;

  return {
    startDate,
    endDate,
    type: 'custom'
  };
}

/**
 * Calculate next generation time
 */
function calculateNextGeneration(schedule = {}) {
  const now = new Date();
  const [hRaw, mRaw] = String((schedule && schedule.time) || '09:00').split(':').map(Number);
  const hours = Number.isFinite(hRaw) ? hRaw : 9;
  const minutes = Number.isFinite(mRaw) ? mRaw : 0;

  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
  case 'daily':
    if (next <= now) next.setDate(next.getDate() + 1);
    break;
  case 'weekly': {
    const target = Number.isFinite(schedule.dayOfWeek) ? schedule.dayOfWeek : next.getDay();
    let dayDiff = target - next.getDay();
    if (dayDiff < 0 || (dayDiff === 0 && next <= now)) dayDiff += 7;
    next.setDate(next.getDate() + dayDiff);
    break;
  }
  case 'monthly':
    next.setDate(schedule.dayOfMonth || 1);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    break;
  case 'quarterly':
    next.setDate(schedule.dayOfMonth || 1);
    while (next <= now) next.setMonth(next.getMonth() + 3);
    break;
  case 'yearly':
    next.setDate(schedule.dayOfMonth || 1);
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
    break;
  default:
    // Unknown/unset frequency — fall back to daily so we NEVER return a time in
    // the past, which would re-fire the report on every cron tick (email storm).
    if (next <= now) next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Deliver report via email
 */
async function deliverViaEmail(report, scheduled) {
  try {
    const recipients = (scheduled.delivery.email && scheduled.delivery.email.recipients) || [];
    if (!recipients.length) {
      logger.warn('Scheduled report has email delivery enabled but no recipients', { scheduledReportId: scheduled._id });
      return;
    }

    const html = await buildBrandedReportEmail(report, scheduled);
    const reportName = report.templateId?.name || 'Performance Report';

    // Reuse the project emailService (sendgrid/SMTP-aware, honest unavailable
    // fallback) instead of an ad-hoc nodemailer transport.
    for (const recipient of recipients) {
      await sendEmail({
        to: recipient,
        subject: `${reportName} is ready`,
        html
      });
    }

    logger.info('Report delivered via email', { reportId: report._id, recipients: recipients.length });
  } catch (error) {
    logger.error('Error delivering report via email', { error: error.message });
  }
}

/**
 * Build a white-label branded HTML email for a generated report: the agency's
 * logo + name and the client's name, per the agency Workspace branding settings.
 */
async function buildBrandedReportEmail(report, scheduled) {
  let agency = null;
  let client = null;
  try {
    [agency, client] = await Promise.all([
      Workspace.findById(scheduled.agencyWorkspaceId).select('name settings.branding').lean(),
      Workspace.findById(scheduled.clientWorkspaceId).select('name').lean()
    ]);
  } catch (e) {
    logger.warn('Could not load workspace branding for report email', { error: e.message });
  }

  const branding = (agency && agency.settings && agency.settings.branding) || {};
  const agencyName = (agency && agency.name) || 'Your Agency';
  const clientName = (client && client.name) || 'your account';
  const accent = branding.primaryColor || '#4f46e5';
  const reportUrl = `${process.env.APP_URL || ''}/reports/${report._id}`;
  const logoTag = branding.logo
    ? `<img src="${branding.logo}" alt="${agencyName}" style="max-height:48px;margin-bottom:16px" />`
    : `<h3 style="color:${accent};margin:0 0 16px">${agencyName}</h3>`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">
      ${logoTag}
      <h2 style="margin:0 0 8px">Your report for ${clientName} is ready</h2>
      <p style="color:#6b7280;margin:0 0 16px">Prepared by ${agencyName}</p>
      ${report.aiSummary?.text ? `<div style="background:#f9fafb;border-left:4px solid ${accent};padding:12px 16px;margin:0 0 16px">${report.aiSummary.text}</div>` : ''}
      <p><a href="${reportUrl}" style="display:inline-block;background:${accent};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View full report</a></p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">${reportUrl}</p>
    </div>
  `;
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
  processScheduledReports,
  // Exported for unit testing of the (pure) scheduling math.
  calculateNextGeneration,
  calculatePeriod
};



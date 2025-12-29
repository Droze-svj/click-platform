// Health Report Scheduler Service
// Automated report generation and delivery

const cron = require('node-cron');
const { generateClientHealthReportPDF } = require('./clientHealthReportService');
const { sendEmail } = require('./emailService');
const ClientHealthScore = require('../models/ClientHealthScore');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

/**
 * Schedule automated health reports
 */
function scheduleHealthReports() {
  // Monthly health reports (1st of month at 9 AM)
  cron.schedule('0 9 1 * *', async () => {
    try {
      logger.info('Running monthly health report generation...');

      // Get all client workspaces
      const clients = await Workspace.find({ isClient: true }).lean();

      for (const client of clients) {
        try {
          // Get agency workspace
          const agency = await Workspace.findById(client.parentWorkspace).lean();
          if (!agency) continue;

          // Get latest health score
          const healthScore = await ClientHealthScore.findOne({
            clientWorkspaceId: client._id
          })
            .sort({ 'period.startDate': -1 })
            .lean();

          if (!healthScore) continue;

          // Generate report
          const endDate = new Date();
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);

          const buffer = await generateClientHealthReportPDF(
            client._id,
            agency._id,
            {
              startDate,
              endDate,
              period: 'monthly'
            }
          );

          // Send email (would integrate with email service)
          // await sendEmail({
          //   to: client.contactEmail,
          //   subject: 'Monthly Health Report',
          //   attachments: [{ filename: 'health-report.pdf', content: buffer }]
          // });

          logger.info('Health report generated and sent', { clientWorkspaceId: client._id });
        } catch (error) {
          logger.warn('Error generating health report for client', {
            clientWorkspaceId: client._id,
            error: error.message
          });
        }
      }

      logger.info('Monthly health report generation completed');
    } catch (error) {
      logger.error('Error in monthly health report cron', { error: error.message });
    }
  }, {
    timezone: process.env.TZ || 'UTC'
  });

  logger.info('Health report scheduler initialized');
}

module.exports = {
  scheduleHealthReports
};



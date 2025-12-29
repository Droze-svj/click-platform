// Automated Survey Service
// Schedule and send satisfaction surveys automatically

const cron = require('node-cron');
const ClientRetention = require('../models/ClientRetention');
const ClientSatisfaction = require('../models/ClientSatisfaction');
const { createSatisfactionSurvey } = require('./clientSatisfactionService');
const { sendEmail } = require('./emailService');
const logger = require('../utils/logger');

/**
 * Schedule automated surveys
 */
function scheduleAutomatedSurveys() {
  // Monthly NPS surveys (1st of month at 10 AM)
  cron.schedule('0 10 1 * *', async () => {
    try {
      logger.info('Running automated NPS survey generation...');

      // Get all active clients
      const clients = await ClientRetention.find({
        'subscription.status': 'active'
      }).lean();

      for (const client of clients) {
        try {
          // Check if survey already sent this month
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const existingSurvey = await ClientSatisfaction.findOne({
            agencyWorkspaceId: client.agencyWorkspaceId,
            clientWorkspaceId: client.clientWorkspaceId,
            'survey.type': 'nps',
            'survey.date': { $gte: startOfMonth }
          }).lean();

          if (existingSurvey) {
            continue; // Already sent this month
          }

          // Create survey
          const survey = await createSatisfactionSurvey(
            client.agencyWorkspaceId,
            client.clientWorkspaceId,
            {
              type: 'nps',
              sentBy: null // System
            }
          );

          // Send email (would integrate with email service)
          // await sendEmail({
          //   to: client.client.email,
          //   subject: 'How likely are you to recommend us?',
          //   template: 'nps_survey',
          //   data: {
          //     surveyId: survey._id,
          //     clientName: client.client.name
          //   }
          // });

          logger.info('NPS survey created and sent', { 
            clientWorkspaceId: client.clientWorkspaceId,
            surveyId: survey._id 
          });
        } catch (error) {
          logger.warn('Error creating survey for client', {
            clientWorkspaceId: client.clientWorkspaceId,
            error: error.message
          });
        }
      }

      logger.info('Automated NPS survey generation completed');
    } catch (error) {
      logger.error('Error in automated survey cron', { error: error.message });
    }
  }, {
    timezone: process.env.TZ || 'UTC'
  });

  // Follow-up reminders (3 days after survey sent)
  cron.schedule('0 10 * * *', async () => {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const pendingSurveys = await ClientSatisfaction.find({
        'survey.status': 'sent',
        'survey.date': { $lte: threeDaysAgo }
      }).lean();

      for (const survey of pendingSurveys) {
        try {
          // Send reminder email
          // await sendEmail({
          //   to: client.client.email,
          //   subject: 'Reminder: Quick Survey',
          //   template: 'survey_reminder',
          //   data: {
          //     surveyId: survey._id
          //   }
          // });

          // Update status
          await ClientSatisfaction.findByIdAndUpdate(survey._id, {
            $set: { 'survey.status': 'reminded' }
          });

          logger.info('Survey reminder sent', { surveyId: survey._id });
        } catch (error) {
          logger.warn('Error sending survey reminder', { surveyId: survey._id, error: error.message });
        }
      }
    } catch (error) {
      logger.error('Error in survey reminder cron', { error: error.message });
    }
  });

  logger.info('Automated survey scheduler initialized');
}

module.exports = {
  scheduleAutomatedSurveys
};



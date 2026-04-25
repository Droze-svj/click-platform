// Analytics Export Service

const { getUserAnalytics, getPlatformAnalytics } = require('./analyticsService');
const logger = require('../utils/logger');

/**
 * Export user analytics to CSV
 */
async function exportUserAnalyticsToCSV(userId, timeRange = '30d') {
  try {
    const analytics = await getUserAnalytics(userId, timeRange);
    
    // Convert to CSV format
    const csv = [
      'Metric,Value',
      `Time Range,${analytics.timeRange}`,
      `Content Created,${analytics.content.created}`,
      `Posts Scheduled,${analytics.content.scheduled}`,
      `Posts Published,${analytics.content.published}`,
      `Videos Processed,${analytics.usage.videosProcessed}`,
      `Content Generated,${analytics.usage.contentGenerated}`,
      `Quotes Created,${analytics.usage.quotesCreated}`,
      `Posts Scheduled (Usage),${analytics.usage.postsScheduled}`,
      `Scripts Generated,${analytics.usage.scriptsGenerated}`,
      `Exported At,${analytics.timestamp}`,
    ].join('\n');

    return csv;
  } catch (error) {
    logger.error('Export user analytics error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Export user analytics to JSON
 */
async function exportUserAnalyticsToJSON(userId, timeRange = '30d') {
  try {
    const analytics = await getUserAnalytics(userId, timeRange);
    return JSON.stringify(analytics, null, 2);
  } catch (error) {
    logger.error('Export user analytics error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Export platform analytics to CSV
 */
async function exportPlatformAnalyticsToCSV(timeRange = '30d') {
  try {
    const analytics = await getPlatformAnalytics(timeRange);
    
    const csv = [
      'Metric,Value',
      `Time Range,${analytics.timeRange}`,
      `Total Users,${analytics.users.total}`,
      `Active Users,${analytics.users.active}`,
      `Users with Analytics Consent,${analytics.users.withAnalyticsConsent}`,
      `Total Content,${analytics.content.total}`,
      `Total Posts,${analytics.content.posts}`,
      `Exported At,${analytics.timestamp}`,
    ].join('\n');

    return csv;
  } catch (error) {
    logger.error('Export platform analytics error', { error: error.message });
    throw error;
  }
}

/**
 * Export platform analytics to JSON
 */
async function exportPlatformAnalyticsToJSON(timeRange = '30d') {
  try {
    const analytics = await getPlatformAnalytics(timeRange);
    return JSON.stringify(analytics, null, 2);
  } catch (error) {
    logger.error('Export platform analytics error', { error: error.message });
    throw error;
  }
}

module.exports = {
  exportUserAnalyticsToCSV,
  exportUserAnalyticsToJSON,
  exportPlatformAnalyticsToCSV,
  exportPlatformAnalyticsToJSON,
};





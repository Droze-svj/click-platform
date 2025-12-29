// Content Insights Report Service
// Generate exportable content insights reports

const ContentPerformance = require('../models/ContentPerformance');
const VideoMetrics = require('../models/VideoMetrics');
const { getTopPerformingPosts } = require('./topPerformingPostsService');
const { getVideoMetricsAnalytics } = require('./videoMetricsService');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

/**
 * Generate Excel content insights report
 */
async function generateContentInsightsReportExcel(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const workbook = new ExcelJS.Workbook();

    // Top Performers Sheet
    const topPerformers = await getTopPerformingPosts(workspaceId, {
      limit: 20,
      platform,
      startDate,
      endDate
    });

    const topSheet = workbook.addWorksheet('Top Performers');
    topSheet.columns = [
      { header: 'Rank', key: 'rank', width: 10 },
      { header: 'Platform', key: 'platform', width: 15 },
      { header: 'Format', key: 'format', width: 15 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Engagement', key: 'engagement', width: 15 },
      { header: 'Clicks', key: 'clicks', width: 15 },
      { header: 'Conversions', key: 'conversions', width: 15 },
      { header: 'Overall Score', key: 'score', width: 15 }
    ];

    topPerformers.posts.forEach((post, index) => {
      topSheet.addRow({
        rank: index + 1,
        platform: post.platform,
        format: post.content?.format || 'N/A',
        type: post.content?.type || 'N/A',
        engagement: post.performance.engagement || 0,
        clicks: post.performance.clicks || 0,
        conversions: post.performance.conversions || 0,
        score: post.scores.overall || 0
      });
    });

    // Video Metrics Sheet
    const videoAnalytics = await getVideoMetricsAnalytics(workspaceId, {
      startDate,
      endDate,
      platform
    });

    if (videoAnalytics.totalVideos > 0) {
      const videoSheet = workbook.addWorksheet('Video Metrics');
      videoSheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 }
      ];

      videoSheet.addRow({ metric: 'Total Videos', value: videoAnalytics.totalVideos });
      videoSheet.addRow({ metric: 'Total Views', value: videoAnalytics.totalViews });
      videoSheet.addRow({ metric: 'Avg View-Through Rate', value: `${videoAnalytics.averageViewThroughRate.toFixed(2)}%` });
      videoSheet.addRow({ metric: 'Avg Completion Rate', value: `${videoAnalytics.averageCompletionRate.toFixed(2)}%` });
      videoSheet.addRow({ metric: 'Avg Watch Time', value: `${videoAnalytics.averageWatchTime.toFixed(2)}s` });
      videoSheet.addRow({ metric: 'Avg Retention', value: `${videoAnalytics.averageRetention.toFixed(2)}%` });
    }

    // Format Performance Sheet
    const formatSheet = workbook.addWorksheet('Format Performance');
    formatSheet.columns = [
      { header: 'Format', key: 'format', width: 20 },
      { header: 'Count', key: 'count', width: 15 },
      { header: 'Avg Score', key: 'score', width: 15 }
    ];

    if (topPerformers.insights.formats) {
      Object.entries(topPerformers.insights.formats).forEach(([format, data]) => {
        formatSheet.addRow({
          format,
          count: data.count,
          score: data.averageScore.toFixed(2)
        });
      });
    }

    // Topic Performance Sheet
    const topicSheet = workbook.addWorksheet('Topic Performance');
    topicSheet.columns = [
      { header: 'Topic', key: 'topic', width: 30 },
      { header: 'Count', key: 'count', width: 15 },
      { header: 'Avg Score', key: 'score', width: 15 }
    ];

    if (topPerformers.insights.topics) {
      Object.entries(topPerformers.insights.topics)
        .sort((a, b) => b[1].averageScore - a[1].averageScore)
        .slice(0, 20)
        .forEach(([topic, data]) => {
          topicSheet.addRow({
            topic,
            count: data.count,
            score: data.averageScore.toFixed(2)
          });
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Error generating content insights report', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Generate PDF content insights report
 */
async function generateContentInsightsReportPDF(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const topPerformers = await getTopPerformingPosts(workspaceId, {
      limit: 10,
      platform,
      startDate,
      endDate
    });

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('Content Insights Report', { align: 'center' });
    doc.moveDown();

    // Top Performers
    doc.fontSize(16).text('Top Performing Posts', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);

    topPerformers.posts.slice(0, 10).forEach((post, index) => {
      doc.text(`${index + 1}. ${post.platform} - ${post.content?.format || 'N/A'}`);
      doc.fontSize(10)
        .text(`   Engagement: ${post.performance.engagement || 0} | Clicks: ${post.performance.clicks || 0} | Score: ${post.scores.overall || 0}`)
        .fontSize(12);
      doc.moveDown(0.3);
    });

    doc.moveDown();

    // Insights
    if (topPerformers.insights.commonElements) {
      doc.fontSize(16).text('Key Insights', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);

      topPerformers.insights.commonElements.forEach(element => {
        doc.text(`Best ${element.element}: ${element.value} (Score: ${element.score.toFixed(1)})`);
      });
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating PDF content insights report', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  generateContentInsightsReportExcel,
  generateContentInsightsReportPDF
};



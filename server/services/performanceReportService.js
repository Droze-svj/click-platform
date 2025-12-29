// Performance Report Service
// Generate exportable performance reports

const ScheduledPost = require('../models/ScheduledPost');
const AudienceGrowth = require('../models/AudienceGrowth');
const { getAggregatedPerformanceMetrics } = require('./socialPerformanceMetricsService');
const { getAudienceGrowthTrends } = require('./socialPerformanceMetricsService');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

/**
 * Generate Excel performance report
 */
async function generatePerformanceReportExcel(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    const metrics = await getAggregatedPerformanceMetrics(workspaceId, { startDate, endDate, platform });

    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    summarySheet.addRow({ metric: 'PERFORMANCE SUMMARY', value: '' });
    summarySheet.addRow({ metric: 'Total Posts', value: metrics.totalPosts });
    summarySheet.addRow({ metric: 'Total Impressions', value: metrics.totalImpressions.toLocaleString() });
    summarySheet.addRow({ metric: 'Total Reach', value: metrics.totalReach.toLocaleString() });
    summarySheet.addRow({ metric: 'Total Engagement', value: metrics.totalEngagement.toLocaleString() });
    summarySheet.addRow({ metric: 'Avg Engagement Rate (by Reach)', value: `${metrics.averageEngagementRate.byReach.toFixed(2)}%` });
    summarySheet.addRow({ metric: 'Avg Engagement Rate (by Impressions)', value: `${metrics.averageEngagementRate.byImpressions.toFixed(2)}%` });
    summarySheet.addRow({});

    // Engagement Breakdown Sheet
    const breakdownSheet = workbook.addWorksheet('Engagement Breakdown');
    breakdownSheet.columns = [
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Count', key: 'count', width: 15 }
    ];

    Object.entries(metrics.engagementBreakdown).forEach(([type, count]) => {
      breakdownSheet.addRow({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count: count.toLocaleString()
      });
    });

    // Platform Breakdown Sheet
    if (Object.keys(metrics.byPlatform).length > 0) {
      const platformSheet = workbook.addWorksheet('Platform Breakdown');
      platformSheet.columns = [
        { header: 'Platform', key: 'platform', width: 15 },
        { header: 'Posts', key: 'posts', width: 10 },
        { header: 'Impressions', key: 'impressions', width: 15 },
        { header: 'Reach', key: 'reach', width: 15 },
        { header: 'Engagement', key: 'engagement', width: 15 },
        { header: 'Engagement Rate (by Reach)', key: 'rate', width: 20 }
      ];

      Object.entries(metrics.byPlatform).forEach(([platform, data]) => {
        platformSheet.addRow({
          platform,
          posts: data.posts,
          impressions: data.impressions.toLocaleString(),
          reach: data.reach.toLocaleString(),
          engagement: data.engagement.toLocaleString(),
          rate: `${data.engagementRate.byReach.toFixed(2)}%`
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Error generating performance report', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Generate PDF performance report
 */
async function generatePerformanceReportPDF(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const metrics = await getAggregatedPerformanceMetrics(workspaceId, { startDate, endDate, platform });

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('Social Performance Report', { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(16).text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Posts: ${metrics.totalPosts}`);
    doc.text(`Total Impressions: ${metrics.totalImpressions.toLocaleString()}`);
    doc.text(`Total Reach: ${metrics.totalReach.toLocaleString()}`);
    doc.text(`Total Engagement: ${metrics.totalEngagement.toLocaleString()}`);
    doc.text(`Average Engagement Rate: ${metrics.averageEngagementRate.byReach.toFixed(2)}%`);
    doc.moveDown();

    // Engagement Breakdown
    doc.fontSize(16).text('Engagement Breakdown', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    Object.entries(metrics.engagementBreakdown).forEach(([type, count]) => {
      doc.text(`${type.charAt(0).toUpperCase() + type.slice(1)}: ${count.toLocaleString()}`);
    });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating PDF report', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  generatePerformanceReportExcel,
  generatePerformanceReportPDF
};



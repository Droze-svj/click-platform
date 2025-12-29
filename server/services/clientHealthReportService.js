// Client Health Report Service
// Generate exportable client health reports

const ClientHealthScore = require('../models/ClientHealthScore');
const BrandAwareness = require('../models/BrandAwareness');
const CompetitorBenchmark = require('../models/CompetitorBenchmark');
const KeyWin = require('../models/KeyWin');
const { getClientHealthDashboard } = require('./clientHealthService');
const { getBenchmarkComparison } = require('./competitorBenchmarkService');
// Lazy load exceljs to prevent startup crashes if not installed
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch (error) {
  // ExcelJS is optional, continue without it
  console.warn('ExcelJS not available, Excel export will be disabled');
}
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

/**
 * Generate Excel client health report
 */
async function generateClientHealthReportExcel(clientWorkspaceId, agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      period = 'monthly'
    } = filters;

    if (!ExcelJS) {
      throw new Error('ExcelJS is not available. Excel export is disabled.');
    }
    const workbook = new ExcelJS.Workbook();

    // Health Score Sheet
    const dashboard = await getClientHealthDashboard(clientWorkspaceId, {
      startDate,
      endDate,
      period
    });

    const healthSheet = workbook.addWorksheet('Health Score');
    healthSheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    healthSheet.addRow({ metric: 'CLIENT HEALTH SUMMARY', value: '' });
    healthSheet.addRow({ metric: 'Current Health Score', value: dashboard.summary.currentScore });
    healthSheet.addRow({ metric: 'Status', value: dashboard.summary.status.toUpperCase() });
    healthSheet.addRow({ metric: 'Trend', value: dashboard.summary.trend });
    healthSheet.addRow({});

    if (dashboard.currentHealth) {
      healthSheet.addRow({ metric: 'COMPONENT SCORES', value: '' });
      healthSheet.addRow({ metric: 'Awareness', value: dashboard.currentHealth.components.awareness.score });
      healthSheet.addRow({ metric: 'Engagement', value: dashboard.currentHealth.components.engagement.score });
      healthSheet.addRow({ metric: 'Growth', value: dashboard.currentHealth.components.growth.score });
      healthSheet.addRow({ metric: 'Quality', value: dashboard.currentHealth.components.quality.score });
      healthSheet.addRow({ metric: 'Sentiment', value: dashboard.currentHealth.components.sentiment.score });
      healthSheet.addRow({});

      if (dashboard.currentHealth.comparison) {
        healthSheet.addRow({ metric: 'COMPARISON', value: '' });
        healthSheet.addRow({ metric: 'vs Previous Period', value: `${dashboard.currentHealth.comparison.previousPeriod.change.toFixed(1)}%` });
        healthSheet.addRow({ metric: 'vs Industry Average', value: `${dashboard.currentHealth.comparison.industryAverage.difference.toFixed(1)} points` });
        healthSheet.addRow({ metric: 'Percentile', value: `${dashboard.currentHealth.comparison.percentile}%` });
      }
    }

    // Key Wins Sheet
    if (dashboard.keyWins.length > 0) {
      const winsSheet = workbook.addWorksheet('Key Wins');
      winsSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Type', key: 'type', width: 20 },
        { header: 'Title', key: 'title', width: 40 },
        { header: 'Impact', key: 'impact', width: 15 },
        { header: 'Reach', key: 'reach', width: 15 },
        { header: 'Media Value', key: 'mediaValue', width: 15 }
      ];

      dashboard.keyWins.forEach(win => {
        winsSheet.addRow({
          date: win.win.date.toISOString().split('T')[0],
          type: win.win.type,
          title: win.win.title,
          impact: win.win.impact,
          reach: win.metrics.reach || 0,
          mediaValue: `$${win.metrics.mediaValue || 0}`
        });
      });
    }

    // Sentiment Trends Sheet
    const sentimentSheet = workbook.addWorksheet('Sentiment Trends');
    sentimentSheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    sentimentSheet.addRow({ metric: 'SENTIMENT SUMMARY', value: '' });
    sentimentSheet.addRow({ metric: 'Positive Comments', value: dashboard.sentimentTrend.positive });
    sentimentSheet.addRow({ metric: 'Neutral Comments', value: dashboard.sentimentTrend.neutral });
    sentimentSheet.addRow({ metric: 'Negative Comments', value: dashboard.sentimentTrend.negative });
    sentimentSheet.addRow({ metric: 'Trend', value: dashboard.sentimentTrend.trend > 0 ? 'Improving' : 'Declining' });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Error generating client health report', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Generate PDF client health report
 */
async function generateClientHealthReportPDF(clientWorkspaceId, agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      period = 'monthly'
    } = filters;

    const dashboard = await getClientHealthDashboard(clientWorkspaceId, {
      startDate,
      endDate,
      period
    });

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('Client Health Report', { align: 'center' });
    doc.moveDown();

    // Health Score
    doc.fontSize(16).text('Health Score Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Current Score: ${dashboard.summary.currentScore}/100`);
    doc.text(`Status: ${dashboard.summary.status.toUpperCase()}`);
    doc.text(`Trend: ${dashboard.summary.trend}`);
    doc.moveDown();

    // Component Scores
    if (dashboard.currentHealth) {
      doc.fontSize(16).text('Component Scores', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Awareness: ${dashboard.currentHealth.components.awareness.score}/100`);
      doc.text(`Engagement: ${dashboard.currentHealth.components.engagement.score}/100`);
      doc.text(`Growth: ${dashboard.currentHealth.components.growth.score}/100`);
      doc.text(`Quality: ${dashboard.currentHealth.components.quality.score}/100`);
      doc.text(`Sentiment: ${dashboard.currentHealth.components.sentiment.score}/100`);
      doc.moveDown();
    }

    // Key Wins
    if (dashboard.keyWins.length > 0) {
      doc.fontSize(16).text('Key Wins', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      dashboard.keyWins.forEach((win, index) => {
        doc.text(`${index + 1}. ${win.win.title} (${win.win.type})`);
        doc.fontSize(10).text(`   Impact: ${win.win.impact} | Reach: ${win.metrics.reach || 0}`).fontSize(12);
        doc.moveDown(0.3);
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
    logger.error('Error generating PDF client health report', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  generateClientHealthReportExcel,
  generateClientHealthReportPDF
};


// Revenue Report Service
// Generate exportable revenue reports

const RevenueAttribution = require('../models/RevenueAttribution');
const Conversion = require('../models/Conversion');
const CustomerLTV = require('../models/CustomerLTV');
const { getROASROIDashboard } = require('./roasRoiService');
const { getConversionAnalytics } = require('./conversionTrackingService');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

/**
 * Generate Excel revenue report
 */
async function generateRevenueReportExcel(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    const dashboard = await getROASROIDashboard(workspaceId, { startDate, endDate, platform });
    const conversionAnalytics = await getConversionAnalytics(workspaceId, { startDate, endDate, platform });

    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    summarySheet.addRow({ metric: 'REVENUE SUMMARY', value: '' });
    summarySheet.addRow({ metric: 'Total Revenue', value: `$${dashboard.totalRevenue.toFixed(2)}` });
    summarySheet.addRow({ metric: 'Total Costs', value: `$${dashboard.totalCosts.toFixed(2)}` });
    summarySheet.addRow({ metric: 'Total ROAS', value: dashboard.totalROAS.toFixed(2) });
    summarySheet.addRow({ metric: 'Total ROI (%)', value: `${dashboard.totalROI.toFixed(2)}%` });
    summarySheet.addRow({ metric: 'Total Conversions', value: conversionAnalytics.totalConversions });
    summarySheet.addRow({ metric: 'Conversion Rate (%)', value: `${conversionAnalytics.conversionRate.toFixed(2)}%` });
    summarySheet.addRow({});

    // Revenue by Platform Sheet
    if (Object.keys(dashboard.byPlatform).length > 0) {
      const platformSheet = workbook.addWorksheet('Revenue by Platform');
      platformSheet.columns = [
        { header: 'Platform', key: 'platform', width: 15 },
        { header: 'Revenue', key: 'revenue', width: 15 },
        { header: 'Costs', key: 'costs', width: 15 },
        { header: 'ROAS', key: 'roas', width: 10 },
        { header: 'ROI (%)', key: 'roi', width: 10 }
      ];

      Object.entries(dashboard.byPlatform).forEach(([platform, data]) => {
        platformSheet.addRow({
          platform,
          revenue: `$${data.revenue.toFixed(2)}`,
          costs: `$${data.costs.toFixed(2)}`,
          roas: data.roas.toFixed(2),
          roi: `${data.roi.toFixed(2)}%`
        });
      });
    }

    // Conversions Sheet
    const conversionsSheet = workbook.addWorksheet('Conversions');
    conversionsSheet.columns = [
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Count', key: 'count', width: 15 },
      { header: 'Revenue', key: 'revenue', width: 15 }
    ];

    Object.entries(conversionAnalytics.byType).forEach(([type, data]) => {
      conversionsSheet.addRow({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count: data.count,
        revenue: `$${data.revenue.toFixed(2)}`
      });
    });

    // Trends Sheet
    if (dashboard.trends.length > 0) {
      const trendsSheet = workbook.addWorksheet('Trends');
      trendsSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Revenue', key: 'revenue', width: 15 },
        { header: 'Costs', key: 'costs', width: 15 },
        { header: 'ROAS', key: 'roas', width: 10 },
        { header: 'ROI (%)', key: 'roi', width: 10 }
      ];

      dashboard.trends.forEach(trend => {
        trendsSheet.addRow({
          date: trend.date.toISOString().split('T')[0],
          revenue: `$${trend.revenue.toFixed(2)}`,
          costs: `$${trend.costs.toFixed(2)}`,
          roas: trend.roas.toFixed(2),
          roi: `${trend.roi.toFixed(2)}%`
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Error generating revenue report', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Generate PDF revenue report
 */
async function generateRevenueReportPDF(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const dashboard = await getROASROIDashboard(workspaceId, { startDate, endDate, platform });
    const conversionAnalytics = await getConversionAnalytics(workspaceId, { startDate, endDate, platform });

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('Revenue Impact Report', { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(16).text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Revenue: $${dashboard.totalRevenue.toFixed(2)}`);
    doc.text(`Total Costs: $${dashboard.totalCosts.toFixed(2)}`);
    doc.text(`ROAS: ${dashboard.totalROAS.toFixed(2)}`);
    doc.text(`ROI: ${dashboard.totalROI.toFixed(2)}%`);
    doc.text(`Total Conversions: ${conversionAnalytics.totalConversions}`);
    doc.text(`Conversion Rate: ${conversionAnalytics.conversionRate.toFixed(2)}%`);
    doc.moveDown();

    // Platform Breakdown
    if (Object.keys(dashboard.byPlatform).length > 0) {
      doc.fontSize(16).text('Revenue by Platform', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      Object.entries(dashboard.byPlatform).forEach(([platform, data]) => {
        doc.text(`${platform}: $${data.revenue.toFixed(2)} (ROAS: ${data.roas.toFixed(2)}, ROI: ${data.roi.toFixed(2)}%)`);
      });
      doc.moveDown();
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
    logger.error('Error generating PDF revenue report', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  generateRevenueReportExcel,
  generateRevenueReportPDF
};



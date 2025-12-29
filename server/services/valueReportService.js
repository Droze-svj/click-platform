// Value Report Service
// Generate exportable reports (PDF, Excel) for value tracking

const ClientValueTracking = require('../models/ClientValueTracking');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

/**
 * Generate Excel report for value tracking
 */
async function generateExcelReport(clientWorkspaceId, filters = {}) {
  try {
    const { startDate, endDate } = filters;
    const tracking = await ClientValueTracking.find({
      clientWorkspaceId,
      ...(startDate && endDate ? {
        'period.startDate': { $gte: new Date(startDate), $lte: new Date(endDate) }
      } : {})
    })
      .populate('campaignId', 'name')
      .sort({ 'period.startDate': -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Value Tracking');

    // Headers
    worksheet.columns = [
      { header: 'Period', key: 'period', width: 20 },
      { header: 'Cost', key: 'cost', width: 15 },
      { header: 'Impressions', key: 'impressions', width: 15 },
      { header: 'Engagement', key: 'engagement', width: 15 },
      { header: 'Leads', key: 'leads', width: 15 },
      { header: 'Conversions', key: 'conversions', width: 15 },
      { header: 'Revenue', key: 'revenue', width: 15 },
      { header: 'ROI', key: 'roi', width: 15 },
      { header: 'Time Saved', key: 'timeSaved', width: 15 }
    ];

    // Data rows
    tracking.forEach(record => {
      worksheet.addRow({
        period: `${new Date(record.period.startDate).toLocaleDateString()} - ${new Date(record.period.endDate).toLocaleDateString()}`,
        cost: record.cost.total,
        impressions: record.value.impressions,
        engagement: record.value.engagement,
        leads: record.value.leads,
        conversions: record.value.conversions,
        revenue: record.value.revenue,
        roi: `${record.metrics.roi.toFixed(2)}%`,
        timeSaved: `${record.value.timeSaved.toFixed(1)}h`
      });
    });

    // Summary row
    const totals = tracking.reduce((acc, record) => {
      acc.cost += record.cost.total;
      acc.impressions += record.value.impressions;
      acc.engagement += record.value.engagement;
      acc.leads += record.value.leads;
      acc.conversions += record.value.conversions;
      acc.revenue += record.value.revenue;
      acc.timeSaved += record.value.timeSaved;
      return acc;
    }, { cost: 0, impressions: 0, engagement: 0, leads: 0, conversions: 0, revenue: 0, timeSaved: 0 });

    worksheet.addRow({});
    worksheet.addRow({
      period: 'TOTAL',
      cost: totals.cost,
      impressions: totals.impressions,
      engagement: totals.engagement,
      leads: totals.leads,
      conversions: totals.conversions,
      revenue: totals.revenue,
      timeSaved: `${totals.timeSaved.toFixed(1)}h`
    });

    // Style summary row
    const summaryRow = worksheet.lastRow;
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Error generating Excel report', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Generate PDF report for value tracking
 */
async function generatePDFReport(clientWorkspaceId, filters = {}) {
  try {
    const { startDate, endDate } = filters;
    const tracking = await ClientValueTracking.find({
      clientWorkspaceId,
      ...(startDate && endDate ? {
        'period.startDate': { $gte: new Date(startDate), $lte: new Date(endDate) }
      } : {})
    })
      .populate('campaignId', 'name')
      .sort({ 'period.startDate': -1 })
      .lean();

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {});

    // Header
    doc.fontSize(20).text('Value Tracking Report', { align: 'center' });
    doc.moveDown();

    // Summary
    const totals = tracking.reduce((acc, record) => {
      acc.cost += record.cost.total;
      acc.value += record.value.revenue + record.value.timeSavedValue;
      acc.impressions += record.value.impressions;
      acc.engagement += record.value.engagement;
      acc.leads += record.value.leads;
      acc.conversions += record.value.conversions;
      return acc;
    }, { cost: 0, value: 0, impressions: 0, engagement: 0, leads: 0, conversions: 0 });

    const totalROI = totals.cost > 0 ? ((totals.value - totals.cost) / totals.cost) * 100 : 0;

    doc.fontSize(16).text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Cost: $${totals.cost.toFixed(2)}`);
    doc.text(`Total Value: $${totals.value.toFixed(2)}`);
    doc.text(`ROI: ${totalROI.toFixed(2)}%`);
    doc.text(`Impressions: ${totals.impressions.toLocaleString()}`);
    doc.text(`Engagement: ${totals.engagement.toLocaleString()}`);
    doc.text(`Leads: ${totals.leads}`);
    doc.text(`Conversions: ${totals.conversions}`);
    doc.moveDown();

    // Detailed breakdown
    doc.fontSize(16).text('Period Breakdown', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);

    tracking.forEach((record, index) => {
      if (index > 0 && index % 3 === 0) {
        doc.addPage();
      }

      const period = `${new Date(record.period.startDate).toLocaleDateString()} - ${new Date(record.period.endDate).toLocaleDateString()}`;
      doc.fontSize(12).text(period, { underline: true });
      doc.fontSize(10);
      doc.text(`Cost: $${record.cost.total.toFixed(2)} | ROI: ${record.metrics.roi.toFixed(2)}%`);
      doc.text(`Impressions: ${record.value.impressions.toLocaleString()} | Engagement: ${record.value.engagement.toLocaleString()}`);
      doc.text(`Leads: ${record.value.leads} | Conversions: ${record.value.conversions}`);
      doc.moveDown(0.5);
    });

    doc.end();

    // Wait for PDF to finish
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating PDF report', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  generateExcelReport,
  generatePDFReport
};



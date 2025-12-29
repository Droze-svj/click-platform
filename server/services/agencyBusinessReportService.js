// Agency Business Report Service
// Generate exportable business reports

const { getAgencyBusinessDashboard } = require('./agencyBusinessDashboardService');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

/**
 * Generate Excel business report
 */
async function generateAgencyBusinessReportExcel(agencyWorkspaceId, filters = {}) {
  try {
    const dashboard = await getAgencyBusinessDashboard(agencyWorkspaceId, filters);

    const workbook = new ExcelJS.Workbook();

    // Overview Sheet
    const overviewSheet = workbook.addWorksheet('Overview');
    overviewSheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    overviewSheet.addRow({ metric: 'AGENCY BUSINESS OVERVIEW', value: '' });
    overviewSheet.addRow({ metric: 'Health Score', value: dashboard.overview.healthScore });
    overviewSheet.addRow({ metric: 'Retention Rate', value: `${dashboard.overview.summary.retentionRate}%` });
    overviewSheet.addRow({ metric: 'NPS', value: dashboard.overview.summary.nps });
    overviewSheet.addRow({ metric: 'Average CPA', value: `$${dashboard.overview.summary.averageCPA}` });
    overviewSheet.addRow({ metric: 'Utilization Rate', value: `${dashboard.overview.summary.utilizationRate}%` });
    overviewSheet.addRow({});

    // Retention Sheet
    const retentionSheet = workbook.addWorksheet('Retention');
    retentionSheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    retentionSheet.addRow({ metric: 'RETENTION METRICS', value: '' });
    retentionSheet.addRow({ metric: 'Total Clients', value: dashboard.retention.summary.totalClients });
    retentionSheet.addRow({ metric: 'Active Clients', value: dashboard.retention.summary.activeClients });
    retentionSheet.addRow({ metric: 'Churned Clients', value: dashboard.retention.summary.churnedClients });
    retentionSheet.addRow({ metric: 'Retention Rate', value: `${dashboard.retention.summary.retentionRate}%` });
    retentionSheet.addRow({ metric: 'Churn Rate', value: `${dashboard.retention.summary.churnRate}%` });
    retentionSheet.addRow({ metric: 'Average LTV', value: `$${dashboard.retention.summary.averageLTV}` });
    retentionSheet.addRow({ metric: 'Average Lifetime', value: `${dashboard.retention.summary.averageLifetime} months` });
    retentionSheet.addRow({ metric: 'At-Risk Clients', value: dashboard.retention.summary.atRiskClients });

    // Satisfaction Sheet
    const satisfactionSheet = workbook.addWorksheet('Satisfaction');
    satisfactionSheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    satisfactionSheet.addRow({ metric: 'SATISFACTION METRICS', value: '' });
    satisfactionSheet.addRow({ metric: 'NPS', value: dashboard.satisfaction.nps.nps });
    satisfactionSheet.addRow({ metric: 'Promoters', value: dashboard.satisfaction.nps.promoters });
    satisfactionSheet.addRow({ metric: 'Passives', value: dashboard.satisfaction.nps.passives });
    satisfactionSheet.addRow({ metric: 'Detractors', value: dashboard.satisfaction.nps.detractors });
    satisfactionSheet.addRow({ metric: 'Average CSAT', value: dashboard.satisfaction.csat.average });
    satisfactionSheet.addRow({ metric: 'Average Overall Satisfaction', value: dashboard.satisfaction.overall.average });

    // CPA Sheet
    const cpaSheet = workbook.addWorksheet('CPA/CLTV');
    cpaSheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    cpaSheet.addRow({ metric: 'CPA/CLTV METRICS', value: '' });
    cpaSheet.addRow({ metric: 'Total Campaigns', value: dashboard.cpa.summary.totalCampaigns });
    cpaSheet.addRow({ metric: 'Total Costs', value: `$${dashboard.cpa.summary.totalCosts}` });
    cpaSheet.addRow({ metric: 'Total Revenue', value: `$${dashboard.cpa.summary.totalRevenue}` });
    cpaSheet.addRow({ metric: 'Total Profit', value: `$${dashboard.cpa.summary.totalProfit}` });
    cpaSheet.addRow({ metric: 'Average CPA', value: `$${dashboard.cpa.averages.cpa}` });
    cpaSheet.addRow({ metric: 'Average CLTV', value: `$${dashboard.cpa.averages.cltv}` });
    cpaSheet.addRow({ metric: 'CLTV to CAC Ratio', value: dashboard.cpa.averages.cltvToCAC });
    cpaSheet.addRow({ metric: 'ROAS', value: `${dashboard.cpa.roi.roas}%` });
    cpaSheet.addRow({ metric: 'ROI', value: `${dashboard.cpa.roi.roi}%` });

    // Efficiency Sheet
    if (dashboard.efficiency.summary?.current) {
      const efficiencySheet = workbook.addWorksheet('Efficiency');
      efficiencySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 }
      ];

      const eff = dashboard.efficiency.summary.current;
      efficiencySheet.addRow({ metric: 'EFFICIENCY METRICS', value: '' });
      efficiencySheet.addRow({ metric: 'Total FTE', value: eff.team.totalFTE });
      efficiencySheet.addRow({ metric: 'Utilization Rate', value: `${eff.team.utilizationRate}%` });
      efficiencySheet.addRow({ metric: 'Total Posts', value: eff.content.totalPosts });
      efficiencySheet.addRow({ metric: 'Posts per FTE', value: eff.content.postsPerFTE });
      efficiencySheet.addRow({ metric: 'Revenue per FTE', value: `$${eff.revenue.revenuePerFTE}` });
      efficiencySheet.addRow({ metric: 'Revenue per Hour', value: `$${eff.revenue.revenuePerHour}` });
      efficiencySheet.addRow({ metric: 'Efficiency Score', value: eff.efficiency.efficiencyScore });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Error generating agency business report', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Generate PDF business report
 */
async function generateAgencyBusinessReportPDF(agencyWorkspaceId, filters = {}) {
  try {
    const dashboard = await getAgencyBusinessDashboard(agencyWorkspaceId, filters);

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('Agency Business Report', { align: 'center' });
    doc.moveDown();

    // Overview
    doc.fontSize(16).text('Overview', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Health Score: ${dashboard.overview.healthScore}/100`);
    doc.text(`Retention Rate: ${dashboard.overview.summary.retentionRate}%`);
    doc.text(`NPS: ${dashboard.overview.summary.nps}`);
    doc.text(`Average CPA: $${dashboard.overview.summary.averageCPA}`);
    doc.text(`Utilization Rate: ${dashboard.overview.summary.utilizationRate}%`);
    doc.moveDown();

    // Retention
    doc.fontSize(16).text('Retention', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Clients: ${dashboard.retention.summary.totalClients}`);
    doc.text(`Active Clients: ${dashboard.retention.summary.activeClients}`);
    doc.text(`Churn Rate: ${dashboard.retention.summary.churnRate}%`);
    doc.text(`Average LTV: $${dashboard.retention.summary.averageLTV}`);
    doc.moveDown();

    // Satisfaction
    doc.fontSize(16).text('Satisfaction', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`NPS: ${dashboard.satisfaction.nps.nps}`);
    doc.text(`Promoters: ${dashboard.satisfaction.nps.promoters}`);
    doc.text(`Detractors: ${dashboard.satisfaction.nps.detractors}`);
    doc.moveDown();

    // CPA/CLTV
    doc.fontSize(16).text('CPA/CLTV', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Average CPA: $${dashboard.cpa.averages.cpa}`);
    doc.text(`Average CLTV: $${dashboard.cpa.averages.cltv}`);
    doc.text(`CLTV to CAC Ratio: ${dashboard.cpa.averages.cltvToCAC}`);
    doc.text(`ROI: ${dashboard.cpa.roi.roi}%`);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating PDF business report', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  generateAgencyBusinessReportExcel,
  generateAgencyBusinessReportPDF
};



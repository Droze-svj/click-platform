// Enhanced KPI Dashboard Service
// Customizable dashboards with exports

const { getAgencyKPIDashboard } = require('./kpiDashboardService');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

/**
 * Get customizable KPI dashboard
 */
async function getCustomizableKPIDashboard(agencyWorkspaceId, config = {}) {
  try {
    const {
      widgets = ['performance', 'velocity', 'clients', 'campaigns', 'roi'],
      dateRange = null,
      comparePeriod = true
    } = config;

    // Get base dashboard
    const baseDashboard = await getAgencyKPIDashboard(agencyWorkspaceId, {
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
      comparePeriod
    });

    // Filter widgets based on config
    const dashboard = {
      period: {
        start: dateRange?.startDate || baseDashboard.period?.start,
        end: dateRange?.endDate || baseDashboard.period?.end
      },
      widgets: {}
    };

    if (widgets.includes('performance')) {
      dashboard.widgets.performance = baseDashboard.performance;
    }
    if (widgets.includes('velocity')) {
      dashboard.widgets.velocity = baseDashboard.contentVelocity;
    }
    if (widgets.includes('clients')) {
      dashboard.widgets.clients = baseDashboard.clients;
    }
    if (widgets.includes('campaigns')) {
      dashboard.widgets.campaigns = baseDashboard.campaigns;
    }
    if (widgets.includes('roi')) {
      dashboard.widgets.roi = baseDashboard.roi;
    }

    return dashboard;
  } catch (error) {
    logger.error('Error getting customizable KPI dashboard', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Export KPI dashboard to Excel
 */
async function exportKPIDashboardToExcel(agencyWorkspaceId, config = {}) {
  try {
    const dashboard = await getAgencyKPIDashboard(agencyWorkspaceId, config);

    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Current', key: 'current', width: 20 },
      { header: 'Previous', key: 'previous', width: 20 },
      { header: 'Change', key: 'change', width: 20 }
    ];

    // Performance metrics
    if (dashboard.performance) {
      summarySheet.addRow({ metric: 'PERFORMANCE METRICS', current: '', previous: '', change: '' });
      summarySheet.addRow({
        metric: 'Total Impressions',
        current: dashboard.performance.current.totalImpressions,
        previous: dashboard.performance.previous?.totalImpressions || 0,
        change: dashboard.performance.change?.totalImpressions?.change || 0
      });
      summarySheet.addRow({
        metric: 'Total Engagement',
        current: dashboard.performance.current.totalEngagement,
        previous: dashboard.performance.previous?.totalEngagement || 0,
        change: dashboard.performance.change?.totalEngagement?.change || 0
      });
      summarySheet.addRow({
        metric: 'Total Leads',
        current: dashboard.performance.current.totalLeads,
        previous: dashboard.performance.previous?.totalLeads || 0,
        change: dashboard.performance.change?.totalLeads?.change || 0
      });
      summarySheet.addRow({
        metric: 'Average ROI',
        current: `${dashboard.performance.current.averageROI.toFixed(2)}%`,
        previous: dashboard.performance.previous ? `${dashboard.performance.previous.averageROI.toFixed(2)}%` : '0%',
        change: dashboard.performance.change?.averageROI?.change || 0
      });
      summarySheet.addRow({});
    }

    // Content Velocity
    if (dashboard.contentVelocity) {
      summarySheet.addRow({ metric: 'CONTENT VELOCITY', current: '', previous: '', change: '' });
      summarySheet.addRow({
        metric: 'Posts Per Day',
        current: dashboard.contentVelocity.current.postsPerDay,
        previous: dashboard.contentVelocity.previous?.postsPerDay || 0,
        change: dashboard.contentVelocity.change?.postsPerDay?.change || 0
      });
      summarySheet.addRow({
        metric: 'Content Per Day',
        current: dashboard.contentVelocity.current.contentPerDay,
        previous: dashboard.contentVelocity.previous?.contentPerDay || 0,
        change: dashboard.contentVelocity.change?.contentPerDay?.change || 0
      });
      summarySheet.addRow({});
    }

    // ROI
    if (dashboard.roi) {
      summarySheet.addRow({ metric: 'ROI METRICS', current: '', previous: '', change: '' });
      summarySheet.addRow({
        metric: 'Total Cost',
        current: `$${dashboard.roi.current.totalCost.toFixed(2)}`,
        previous: dashboard.roi.previous ? `$${dashboard.roi.previous.totalCost.toFixed(2)}` : '$0',
        change: dashboard.roi.change?.netValue?.change || 0
      });
      summarySheet.addRow({
        metric: 'Total Value',
        current: `$${dashboard.roi.current.totalValue.toFixed(2)}`,
        previous: dashboard.roi.previous ? `$${dashboard.roi.previous.totalValue.toFixed(2)}` : '$0',
        change: dashboard.roi.change?.netValue?.change || 0
      });
      summarySheet.addRow({
        metric: 'ROI',
        current: `${dashboard.roi.current.roi.toFixed(2)}%`,
        previous: dashboard.roi.previous ? `${dashboard.roi.previous.roi.toFixed(2)}%` : '0%',
        change: dashboard.roi.change?.roi?.change || 0
      });
    }

    // Campaign Highlights Sheet
    if (dashboard.campaigns && dashboard.campaigns.highlights.length > 0) {
      const campaignsSheet = workbook.addWorksheet('Campaign Highlights');
      campaignsSheet.columns = [
        { header: 'Campaign', key: 'name', width: 30 },
        { header: 'Impressions', key: 'impressions', width: 15 },
        { header: 'Engagement', key: 'engagement', width: 15 },
        { header: 'ROI', key: 'roi', width: 15 }
      ];

      dashboard.campaigns.highlights.forEach(campaign => {
        campaignsSheet.addRow({
          name: campaign.name,
          impressions: campaign.impressions,
          engagement: campaign.engagement,
          roi: `${campaign.roi.toFixed(2)}%`
        });
      });
    }

    // Clients by Tier Sheet
    if (dashboard.clients && dashboard.clients.byTier) {
      const clientsSheet = workbook.addWorksheet('Clients by Tier');
      clientsSheet.columns = [
        { header: 'Tier', key: 'tier', width: 20 },
        { header: 'Count', key: 'count', width: 15 }
      ];

      Object.entries(dashboard.clients.byTier).forEach(([tier, count]) => {
        clientsSheet.addRow({
          tier: tier.charAt(0).toUpperCase() + tier.slice(1),
          count
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Error exporting KPI dashboard to Excel', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get client-specific KPI dashboard
 */
async function getClientKPIDashboard(clientWorkspaceId, filters = {}) {
  try {
    const {
      startDate = null,
      endDate = null,
      comparePeriod = true
    } = filters;

    const workspace = await require('../models/Workspace').findById(clientWorkspaceId).lean();
    if (!workspace || !workspace.agencyWorkspaceId) {
      throw new Error('Client workspace not found');
    }

    // Get value tracking
    const ClientValueTracking = require('../models/ClientValueTracking');
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const periodStart = startDate ? new Date(startDate) : currentMonthStart;
    const periodEnd = endDate ? new Date(endDate) : currentMonthEnd;

    const currentTracking = await ClientValueTracking.find({
      clientWorkspaceId,
      'period.startDate': { $gte: periodStart, $lte: periodEnd }
    }).lean();

    let previousTracking = [];
    if (comparePeriod) {
      previousTracking = await ClientValueTracking.find({
        clientWorkspaceId,
        'period.startDate': { $gte: previousMonthStart, $lte: previousMonthEnd }
      }).lean();
    }

    // Calculate metrics
    const current = currentTracking.reduce((acc, record) => {
      acc.cost += record.cost.total;
      acc.value += record.value.revenue + record.value.timeSavedValue;
      acc.impressions += record.value.impressions;
      acc.engagement += record.value.engagement;
      acc.leads += record.value.leads;
      acc.conversions += record.value.conversions;
      acc.timeSaved += record.value.timeSaved;
      return acc;
    }, { cost: 0, value: 0, impressions: 0, engagement: 0, leads: 0, conversions: 0, timeSaved: 0 });

    const previous = previousTracking.reduce((acc, record) => {
      acc.cost += record.cost.total;
      acc.value += record.value.revenue + record.value.timeSavedValue;
      acc.impressions += record.value.impressions;
      acc.engagement += record.value.engagement;
      acc.leads += record.value.leads;
      acc.conversions += record.value.conversions;
      acc.timeSaved += record.value.timeSaved;
      return acc;
    }, { cost: 0, value: 0, impressions: 0, engagement: 0, leads: 0, conversions: 0, timeSaved: 0 });

    const currentROI = current.cost > 0 ? ((current.value - current.cost) / current.cost) * 100 : 0;
    const previousROI = previous.cost > 0 ? ((previous.value - previous.cost) / previous.cost) * 100 : 0;

    return {
      current: {
        ...current,
        roi: currentROI
      },
      previous: comparePeriod ? {
        ...previous,
        roi: previousROI
      } : null,
      change: comparePeriod ? {
        cost: previous.cost !== 0 ? ((current.cost - previous.cost) / previous.cost) * 100 : 0,
        value: previous.value !== 0 ? ((current.value - previous.value) / previous.value) * 100 : 0,
        roi: previousROI !== 0 ? ((currentROI - previousROI) / Math.abs(previousROI)) * 100 : 0,
        impressions: previous.impressions !== 0 ? ((current.impressions - previous.impressions) / previous.impressions) * 100 : 0,
        engagement: previous.engagement !== 0 ? ((current.engagement - previous.engagement) / previous.engagement) * 100 : 0
      } : null
    };
  } catch (error) {
    logger.error('Error getting client KPI dashboard', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  getCustomizableKPIDashboard,
  exportKPIDashboardToExcel,
  getClientKPIDashboard
};



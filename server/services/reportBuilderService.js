// Report Builder Service
// Drag-and-drop metrics, template management, report generation

const ReportTemplate = require('../models/ReportTemplate');
const GeneratedReport = require('../models/GeneratedReport');
const logger = require('../utils/logger');
const { getClientHealthMetrics } = require('./clientHealthService');
// const { getPerformanceMetrics } = require('./performanceMetricsService'); // TODO: Create this service

/**
 * Create or update report template
 */
async function createOrUpdateTemplate(templateData) {
  try {
    const {
      templateId,
      name,
      clientWorkspaceId,
      agencyWorkspaceId,
      branding,
      layout,
      metrics,
      sections,
      aiSummary,
      createdBy
    } = templateData;

    let template;

    if (templateId) {
      template = await ReportTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Update
      if (name) template.name = name;
      if (branding) template.branding = { ...template.branding, ...branding };
      if (layout) template.layout = { ...template.layout, ...layout };
      if (metrics) template.metrics = metrics;
      if (sections) template.sections = sections;
      if (aiSummary) template.aiSummary = { ...template.aiSummary, ...aiSummary };
    } else {
      // Create
      template = new ReportTemplate({
        name,
        clientWorkspaceId,
        agencyWorkspaceId,
        branding: branding || {},
        layout: layout || {},
        metrics: metrics || [],
        sections: sections || [],
        aiSummary: aiSummary || {},
        createdBy
      });
    }

    await template.save();

    logger.info('Report template saved', { templateId: template._id, agencyWorkspaceId });
    return template;
  } catch (error) {
    logger.error('Error creating/updating template', { error: error.message });
    throw error;
  }
}

/**
 * Get templates for client or agency
 */
async function getTemplates(agencyWorkspaceId, clientWorkspaceId = null) {
  try {
    const query = {
      agencyWorkspaceId,
      $or: [
        { clientWorkspaceId: clientWorkspaceId || null },
        { isPublic: true }
      ]
    };

    const templates = await ReportTemplate.find(query)
      .populate('createdBy', 'name email')
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting templates', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Generate report from template
 */
async function generateReport(templateId, period, clientWorkspaceId, agencyWorkspaceId, generatedBy) {
  try {
    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Create report record
    const report = new GeneratedReport({
      templateId,
      clientWorkspaceId,
      agencyWorkspaceId,
      period,
      status: 'generating',
      generatedBy
    });
    await report.save();

    // Generate metrics data
    const metricsData = await generateMetricsData(template.metrics, clientWorkspaceId, period);

    // Generate charts
    const chartsData = await generateChartsData(template.metrics, clientWorkspaceId, period);

    // Generate tables
    const tablesData = await generateTablesData(template.metrics, clientWorkspaceId, period);

    // Update report with data
    report.data = {
      metrics: metricsData,
      charts: chartsData,
      tables: tablesData
    };
    report.status = 'completed';
    await report.save();

    logger.info('Report generated', { reportId: report._id, templateId });
    return report;
  } catch (error) {
    logger.error('Error generating report', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Generate metrics data
 */
async function generateMetricsData(metrics, clientWorkspaceId, period) {
  const metricsData = [];

  for (const metric of metrics) {
    try {
      const value = await getMetricValue(metric.type, clientWorkspaceId, period, metric.config);
      const previousValue = await getMetricValue(metric.type, clientWorkspaceId, {
        startDate: new Date(period.startDate.getTime() - (period.endDate - period.startDate)),
        endDate: period.startDate
      }, metric.config);

      const change = calculateChange(value, previousValue);
      const benchmark = await getBenchmark(metric.type, value);

      metricsData.push({
        metricId: metric.id,
        value,
        formattedValue: formatMetricValue(value, metric.format),
        change,
        benchmark
      });
    } catch (error) {
      logger.warn('Error generating metric', { metricId: metric.id, error: error.message });
    }
  }

  return metricsData;
}

/**
 * Get metric value
 */
async function getMetricValue(metricType, clientWorkspaceId, period, config = {}) {
  switch (metricType) {
    case 'reach':
      return await getReach(clientWorkspaceId, period);
    case 'impressions':
      return await getImpressions(clientWorkspaceId, period);
    case 'engagement_rate':
      return await getEngagementRate(clientWorkspaceId, period);
    case 'ctr':
      return await getCTR(clientWorkspaceId, period);
    case 'conversions':
      return await getConversions(clientWorkspaceId, period);
    case 'roi':
      return await getROI(clientWorkspaceId, period);
    case 'roas':
      return await getROAS(clientWorkspaceId, period);
    case 'brand_awareness':
      return await getBrandAwareness(clientWorkspaceId, period);
    case 'sentiment':
      return await getSentiment(clientWorkspaceId, period);
    case 'health_score':
      return await getHealthScore(clientWorkspaceId);
    case 'audience_growth':
      return await getAudienceGrowth(clientWorkspaceId, period);
    default:
      return 0;
  }
}

/**
 * Get reach
 */
async function getReach(clientWorkspaceId, period) {
  // Would query actual reach data
  return 0;
}

/**
 * Get impressions
 */
async function getImpressions(clientWorkspaceId, period) {
  return 0;
}

/**
 * Get engagement rate
 */
async function getEngagementRate(clientWorkspaceId, period) {
  return 0;
}

/**
 * Get CTR
 */
async function getCTR(clientWorkspaceId, period) {
  return 0;
}

/**
 * Get conversions
 */
async function getConversions(clientWorkspaceId, period) {
  return 0;
}

/**
 * Get ROI
 */
async function getROI(clientWorkspaceId, period) {
  return 0;
}

/**
 * Get ROAS
 */
async function getROAS(clientWorkspaceId, period) {
  return 0;
}

/**
 * Get brand awareness
 */
async function getBrandAwareness(clientWorkspaceId, period) {
  return 0;
}

/**
 * Get sentiment
 */
async function getSentiment(clientWorkspaceId, period) {
  return 0;
}

/**
 * Get health score
 */
async function getHealthScore(clientWorkspaceId) {
  try {
    // Would use actual health service
    // For now, return placeholder
    return 75;
  } catch (error) {
    return 0;
  }
}

/**
 * Get audience growth
 */
async function getAudienceGrowth(clientWorkspaceId, period) {
  return 0;
}

/**
 * Calculate change
 */
function calculateChange(current, previous) {
  if (!previous || previous === 0) {
    return { value: current, percentage: 0, trend: 'stable' };
  }

  const change = current - previous;
  const percentage = ((change / previous) * 100);
  const trend = percentage > 5 ? 'up' : (percentage < -5 ? 'down' : 'stable');

  return {
    value: change,
    percentage: Math.round(percentage * 100) / 100,
    trend
  };
}

/**
 * Get benchmark
 */
async function getBenchmark(metricType, value) {
  // Would query industry benchmarks
  return {
    value: null,
    percentile: null
  };
}

/**
 * Format metric value
 */
function formatMetricValue(value, format) {
  switch (format) {
    case 'percentage':
      return `${value.toFixed(2)}%`;
    case 'currency':
      return `$${value.toLocaleString()}`;
    case 'number':
      return value.toLocaleString();
    default:
      return value.toString();
  }
}

/**
 * Generate charts data
 */
async function generateChartsData(metrics, clientWorkspaceId, period) {
  const chartsData = [];

  for (const metric of metrics) {
    if (metric.chartType) {
      try {
        const chartData = await getChartData(metric.type, clientWorkspaceId, period, metric.chartType);
        chartsData.push({
          metricId: metric.id,
          data: chartData,
          chartType: metric.chartType
        });
      } catch (error) {
        logger.warn('Error generating chart', { metricId: metric.id, error: error.message });
      }
    }
  }

  return chartsData;
}

/**
 * Get chart data
 */
async function getChartData(metricType, clientWorkspaceId, period, chartType) {
  // Would generate time-series or categorical data
  return [];
}

/**
 * Generate tables data
 */
async function generateTablesData(metrics, clientWorkspaceId, period) {
  // Similar to charts, for table-format metrics
  return [];
}

module.exports = {
  createOrUpdateTemplate,
  getTemplates,
  generateReport
};


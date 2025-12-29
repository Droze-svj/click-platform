// Report Comparison Service
// Period-over-period comparisons

const ReportComparison = require('../models/ReportComparison');
const { generateReport } = require('./reportBuilderService');
const { generateReportSummary } = require('./aiReportSummaryService');
const logger = require('../utils/logger');

/**
 * Create report comparison
 */
async function createReportComparison(templateId, clientWorkspaceId, agencyWorkspaceId, currentPeriod, previousPeriod) {
  try {
    // Generate both reports
    const [currentReport, previousReport] = await Promise.all([
      generateReport(templateId, currentPeriod, clientWorkspaceId, agencyWorkspaceId, null),
      generateReport(templateId, previousPeriod, clientWorkspaceId, agencyWorkspaceId, null)
    ]);

    // Get template to know which metrics to compare
    const ReportTemplate = require('../models/ReportTemplate');
    const template = await ReportTemplate.findById(templateId).lean();

    // Compare metrics
    const comparisons = compareMetrics(
      currentReport.data.metrics,
      previousReport.data.metrics,
      template.metrics
    );

    // Create comparison record
    const comparison = new ReportComparison({
      templateId,
      clientWorkspaceId,
      agencyWorkspaceId,
      periods: {
        current: {
          startDate: currentPeriod.startDate,
          endDate: currentPeriod.endDate,
          reportId: currentReport._id
        },
        previous: {
          startDate: previousPeriod.startDate,
          endDate: previousPeriod.endDate,
          reportId: previousReport._id
        }
      },
      comparisons
    });

    await comparison.save();

    // Generate AI comparison summary
    const summary = await generateComparisonSummary(comparison);
    comparison.aiSummary = summary;
    await comparison.save();

    logger.info('Report comparison created', { comparisonId: comparison._id });
    return comparison;
  } catch (error) {
    logger.error('Error creating report comparison', { error: error.message });
    throw error;
  }
}

/**
 * Compare metrics
 */
function compareMetrics(currentMetrics, previousMetrics, templateMetrics) {
  const comparisons = [];

  // Create maps for easy lookup
  const currentMap = {};
  currentMetrics.forEach(m => {
    currentMap[m.metricId] = m;
  });

  const previousMap = {};
  previousMetrics.forEach(m => {
    previousMap[m.metricId] = m;
  });

  // Compare each metric
  templateMetrics.forEach(templateMetric => {
    const current = currentMap[templateMetric.id];
    const previous = previousMap[templateMetric.id];

    if (current && previous) {
      const change = calculateChange(current.value, previous.value);
      const significance = calculateSignificance(change.percentage);

      comparisons.push({
        metricId: templateMetric.id,
        metricType: templateMetric.type,
        current: {
          value: current.value,
          formattedValue: current.formattedValue
        },
        previous: {
          value: previous.value,
          formattedValue: previous.formattedValue
        },
        change,
        significance
      });
    }
  });

  return comparisons;
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
 * Calculate significance
 */
function calculateSignificance(percentage) {
  const abs = Math.abs(percentage);
  if (abs >= 20) return 'significant';
  if (abs >= 10) return 'moderate';
  return 'minor';
}

/**
 * Generate comparison summary
 */
async function generateComparisonSummary(comparison) {
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const significantChanges = comparison.comparisons.filter(c => c.significance === 'significant');
    const improvements = significantChanges.filter(c => c.change.trend === 'up');
    const declines = significantChanges.filter(c => c.change.trend === 'down');

    const prompt = `Generate a comparison summary for a client report comparing two periods.

Current Period: ${formatPeriod(comparison.periods.current)}
Previous Period: ${formatPeriod(comparison.periods.previous)}

Key Changes:
${significantChanges.map(c => `- ${c.metricType}: ${c.change.percentage > 0 ? '+' : ''}${c.change.percentage}%`).join('\n')}

Improvements: ${improvements.length}
Declines: ${declines.length}

Write a professional summary highlighting key changes and insights:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a business analyst providing period-over-period comparison insights.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const text = response.choices[0].message.content;
    const keyChanges = significantChanges.map(c => `${c.metricType} ${c.change.trend === 'up' ? 'increased' : 'decreased'} by ${Math.abs(c.change.percentage)}%`);
    const insights = extractInsights(comparison);
    const recommendations = generateRecommendations(comparison);

    return {
      text,
      keyChanges,
      insights,
      recommendations,
      generatedAt: new Date()
    };
  } catch (error) {
    logger.error('Error generating comparison summary', { error: error.message });
    return {
      text: 'Comparison summary unavailable',
      keyChanges: [],
      insights: [],
      recommendations: [],
      generatedAt: new Date()
    };
  }
}

/**
 * Format period
 */
function formatPeriod(period) {
  return `${new Date(period.startDate).toLocaleDateString()} to ${new Date(period.endDate).toLocaleDateString()}`;
}

/**
 * Extract insights
 */
function extractInsights(comparison) {
  const insights = [];
  
  const topImprovements = comparison.comparisons
    .filter(c => c.change.trend === 'up')
    .sort((a, b) => b.change.percentage - a.change.percentage)
    .slice(0, 3);

  topImprovements.forEach(c => {
    insights.push(`${c.metricType} showed strong growth of ${c.change.percentage}%`);
  });

  return insights;
}

/**
 * Generate recommendations
 */
function generateRecommendations(comparison) {
  const recommendations = [];
  
  const declines = comparison.comparisons.filter(c => c.change.trend === 'down' && c.significance !== 'minor');
  
  declines.forEach(c => {
    recommendations.push(`Focus on improving ${c.metricType} which declined by ${Math.abs(c.change.percentage)}%`);
  });

  if (recommendations.length === 0) {
    recommendations.push('Continue current strategy to maintain performance');
  }

  return recommendations;
}

module.exports = {
  createReportComparison
};

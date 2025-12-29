// Workload Analytics Service
// Advanced analytics, comparisons, forecasting

const WorkloadDashboard = require('../models/WorkloadDashboard');
const logger = require('../utils/logger');

/**
 * Compare clients
 */
async function compareClients(userId, clientIds, period = 'month') {
  try {
    const { startDate, endDate } = getPeriodDates(period);
    
    const dashboards = await WorkloadDashboard.find({
      userId,
      clientId: { $in: clientIds },
      'period.start': startDate,
      'period.end': endDate
    })
      .populate('clientId', 'name')
      .lean();

    const comparison = {
      period: { start: startDate, end: endDate, type: period },
      clients: dashboards.map(d => ({
        client: {
          id: d.clientId._id,
          name: d.clientId.name
        },
        workload: d.workload,
        efficiency: d.efficiency,
        profit: d.profit,
        contentGaps: d.contentGaps
      })),
      averages: calculateAverages(dashboards),
      rankings: calculateRankings(dashboards),
      insights: generateInsights(dashboards)
    };

    return comparison;
  } catch (error) {
    logger.error('Error comparing clients', { error: error.message, userId });
    throw error;
  }
}

/**
 * Forecast workload
 */
async function forecastWorkload(userId, clientId, periods = 3) {
  try {
    // Get historical data
    const historical = await WorkloadDashboard.find({
      userId,
      clientId
    })
      .sort({ 'period.start': -1 })
      .limit(6)
      .lean();

    if (historical.length < 2) {
      return {
        forecast: null,
        confidence: 'low',
        message: 'Insufficient data for forecasting'
      };
    }

    // Calculate trends
    const trends = calculateWorkloadTrends(historical);

    // Forecast future periods
    const forecast = [];
    for (let i = 1; i <= periods; i++) {
      const periodForecast = {
        period: i,
        workload: {
          postsCreated: forecastValue(historical, 'workload.postsCreated', trends.posts, i),
          postsPerWeek: forecastValue(historical, 'workload.postsPerWeek', trends.postsPerWeek, i)
        },
        efficiency: {
          timeSaved: forecastValue(historical, 'efficiency.timeSaved', trends.timeSaved, i),
          automationRate: forecastValue(historical, 'efficiency.automationRate', trends.automationRate, i)
        },
        profit: {
          revenue: forecastValue(historical, 'profit.revenue', trends.revenue, i),
          profit: forecastValue(historical, 'profit.profit', trends.profit, i)
        }
      };
      forecast.push(periodForecast);
    }

    const confidence = historical.length >= 6 ? 'high' : historical.length >= 3 ? 'medium' : 'low';

    return {
      forecast,
      trends,
      confidence,
      recommendations: generateForecastRecommendations(forecast, trends)
    };
  } catch (error) {
    logger.error('Error forecasting workload', { error: error.message, userId, clientId });
    throw error;
  }
}

/**
 * Get team workload distribution
 */
async function getTeamWorkloadDistribution(userId, period = 'month') {
  try {
    const { startDate, endDate } = getPeriodDates(period);
    
    // Get all client dashboards
    const dashboards = await WorkloadDashboard.find({
      userId,
      'period.start': startDate,
      'period.end': endDate
    })
      .populate('clientId', 'name')
      .lean();

    // Group by team member (would track actual assignments)
    const distribution = {
      totalClients: dashboards.length,
      totalPosts: dashboards.reduce((sum, d) => sum + d.workload.postsCreated, 0),
      totalTimeSaved: dashboards.reduce((sum, d) => sum + d.efficiency.timeSaved, 0),
      clients: dashboards.map(d => ({
        client: {
          id: d.clientId._id,
          name: d.clientId.name
        },
        workload: d.workload.postsCreated,
        efficiency: d.efficiency.efficiencyScore,
        profit: d.profit.profit
      })),
      workloadByClient: dashboards.map(d => ({
        client: d.clientId.name,
        posts: d.workload.postsCreated,
        percentage: 0 // Would calculate
      }))
    };

    // Calculate percentages
    if (distribution.totalPosts > 0) {
      distribution.workloadByClient.forEach(client => {
        client.percentage = Math.round((client.posts / distribution.totalPosts) * 100);
      });
    }

    return distribution;
  } catch (error) {
    logger.error('Error getting team workload distribution', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate averages
 */
function calculateAverages(dashboards) {
  if (dashboards.length === 0) return null;

  return {
    workload: {
      postsCreated: Math.round(dashboards.reduce((sum, d) => sum + d.workload.postsCreated, 0) / dashboards.length),
      postsPerWeek: Math.round(dashboards.reduce((sum, d) => sum + d.workload.postsPerWeek, 0) / dashboards.length)
    },
    efficiency: {
      timeSaved: Math.round(dashboards.reduce((sum, d) => sum + d.efficiency.timeSaved, 0) / dashboards.length * 10) / 10,
      automationRate: Math.round(dashboards.reduce((sum, d) => sum + d.efficiency.automationRate, 0) / dashboards.length),
      efficiencyScore: Math.round(dashboards.reduce((sum, d) => sum + d.efficiency.efficiencyScore, 0) / dashboards.length)
    },
    profit: {
      revenue: Math.round(dashboards.reduce((sum, d) => sum + d.profit.revenue, 0) / dashboards.length),
      profit: Math.round(dashboards.reduce((sum, d) => sum + d.profit.profit, 0) / dashboards.length),
      profitMargin: Math.round(dashboards.reduce((sum, d) => sum + d.profit.profitMargin, 0) / dashboards.length)
    }
  };
}

/**
 * Calculate rankings
 */
function calculateRankings(dashboards) {
  const sorted = {
    byPosts: [...dashboards].sort((a, b) => b.workload.postsCreated - a.workload.postsCreated),
    byEfficiency: [...dashboards].sort((a, b) => b.efficiency.efficiencyScore - a.efficiency.efficiencyScore),
    byProfit: [...dashboards].sort((a, b) => b.profit.profit - a.profit.profit)
  };

  return {
    topPosts: sorted.byPosts.slice(0, 3).map(d => ({
      client: d.clientId.name,
      posts: d.workload.postsCreated
    })),
    topEfficiency: sorted.byEfficiency.slice(0, 3).map(d => ({
      client: d.clientId.name,
      score: d.efficiency.efficiencyScore
    })),
    topProfit: sorted.byProfit.slice(0, 3).map(d => ({
      client: d.clientId.name,
      profit: d.profit.profit
    }))
  };
}

/**
 * Generate insights
 */
function generateInsights(dashboards) {
  const insights = [];

  // Find most efficient client
  const mostEfficient = dashboards.reduce((max, d) => 
    d.efficiency.efficiencyScore > max.efficiency.efficiencyScore ? d : max, dashboards[0]);
  if (mostEfficient) {
    insights.push({
      type: 'efficiency',
      message: `${mostEfficient.clientId.name} has the highest efficiency score (${mostEfficient.efficiency.efficiencyScore})`,
      recommendation: 'Consider applying their strategies to other clients'
    });
  }

  // Find most profitable client
  const mostProfitable = dashboards.reduce((max, d) => 
    d.profit.profit > max.profit.profit ? d : max, dashboards[0]);
  if (mostProfitable) {
    insights.push({
      type: 'profit',
      message: `${mostProfitable.clientId.name} generates the most profit ($${mostProfitable.profit.profit})`,
      recommendation: 'Analyze their content strategy for best practices'
    });
  }

  return insights;
}

/**
 * Calculate workload trends
 */
function calculateWorkloadTrends(historical) {
  const trends = {
    posts: 'stable',
    postsPerWeek: 'stable',
    timeSaved: 'stable',
    automationRate: 'stable',
    revenue: 'stable',
    profit: 'stable'
  };

  if (historical.length < 2) return trends;

  const first = historical[historical.length - 1];
  const last = historical[0];

  Object.keys(trends).forEach(key => {
    const firstValue = getNestedValue(first, key);
    const lastValue = getNestedValue(last, key);
    
    if (firstValue > 0 && lastValue > 0) {
      const change = ((lastValue - firstValue) / firstValue) * 100;
      trends[key] = change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable';
    }
  });

  return trends;
}

/**
 * Get nested value
 */
function getNestedValue(obj, path) {
  const paths = {
    posts: 'workload.postsCreated',
    postsPerWeek: 'workload.postsPerWeek',
    timeSaved: 'efficiency.timeSaved',
    automationRate: 'efficiency.automationRate',
    revenue: 'profit.revenue',
    profit: 'profit.profit'
  };

  const fullPath = paths[path] || path;
  return fullPath.split('.').reduce((o, p) => o?.[p], obj) || 0;
}

/**
 * Forecast value
 */
function forecastValue(historical, path, trend, periodsAhead) {
  const values = historical.map(h => {
    const parts = path.split('.');
    return parts.reduce((o, p) => o?.[p], h) || 0;
  });

  if (values.length === 0) return 0;

  const lastValue = values[0];
  const avgGrowth = calculateAverageGrowth(values);

  if (trend === 'increasing') {
    return Math.round(lastValue * Math.pow(1 + avgGrowth, periodsAhead));
  } else if (trend === 'decreasing') {
    return Math.round(lastValue * Math.pow(1 - Math.abs(avgGrowth), periodsAhead));
  } else {
    return lastValue;
  }
}

/**
 * Calculate average growth
 */
function calculateAverageGrowth(values) {
  if (values.length < 2) return 0;

  const growthRates = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      growthRates.push((values[i] - values[i - 1]) / values[i - 1]);
    }
  }

  return growthRates.length > 0
    ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
    : 0;
}

/**
 * Generate forecast recommendations
 */
function generateForecastRecommendations(forecast, trends) {
  const recommendations = [];

  if (trends.posts === 'decreasing') {
    recommendations.push({
      type: 'workload',
      priority: 'high',
      message: 'Forecast shows decreasing posts. Consider increasing content production.',
      action: 'increase_content_production'
    });
  }

  if (trends.automationRate === 'stable' && trends.automationRate < 50) {
    recommendations.push({
      type: 'efficiency',
      priority: 'medium',
      message: 'Automation rate is low. Consider implementing more automation.',
      action: 'increase_automation'
    });
  }

  return recommendations;
}

/**
 * Get period dates
 */
function getPeriodDates(period) {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = now;
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
  }

  return { startDate, endDate };
}

module.exports = {
  compareClients,
  forecastWorkload,
  getTeamWorkloadDistribution
};



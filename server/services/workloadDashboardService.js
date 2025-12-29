// Workload Dashboard Service
// Calculate workload and efficiency metrics per client

const WorkloadDashboard = require('../models/WorkloadDashboard');
const Content = require('../models/Content');
const AutomationRule = require('../models/AutomationRule');
const logger = require('../utils/logger');

/**
 * Get workload dashboard for client
 */
async function getWorkloadDashboard(userId, clientId, period = 'month') {
  try {
    const { startDate, endDate } = getPeriodDates(period);
    
    // Get or create dashboard
    let dashboard = await WorkloadDashboard.findOne({
      userId,
      clientId,
      'period.start': startDate,
      'period.end': endDate
    }).lean();

    if (!dashboard) {
      dashboard = await calculateWorkloadDashboard(userId, clientId, startDate, endDate, period);
    }

    return dashboard;
  } catch (error) {
    logger.error('Error getting workload dashboard', { error: error.message, userId, clientId });
    throw error;
  }
}

/**
 * Calculate workload dashboard
 */
async function calculateWorkloadDashboard(userId, clientId, startDate, endDate, periodType) {
  try {
    // Get content metrics
    const contentMetrics = await getContentMetrics(userId, clientId, startDate, endDate);
    
    // Get efficiency metrics
    const efficiencyMetrics = await getEfficiencyMetrics(userId, clientId, startDate, endDate);
    
    // Get content gaps
    const contentGaps = await getContentGaps(userId, clientId, startDate, endDate);
    
    // Get profit indicators
    const profitIndicators = await getProfitIndicators(userId, clientId, startDate, endDate);

    // Calculate trends
    const trends = await calculateTrends(userId, clientId, startDate, endDate);

    const dashboard = new WorkloadDashboard({
      userId,
      clientId,
      period: {
        start: startDate,
        end: endDate,
        type: periodType
      },
      workload: contentMetrics,
      efficiency: efficiencyMetrics,
      contentGaps,
      profit: profitIndicators,
      trends
    });

    await dashboard.save();
    return dashboard;
  } catch (error) {
    logger.error('Error calculating workload dashboard', { error: error.message, userId, clientId });
    throw error;
  }
}

/**
 * Get content metrics
 */
async function getContentMetrics(userId, clientId, startDate, endDate) {
  try {
    const contents = await Content.find({
      userId,
      clientId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();

    const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const weeksDiff = daysDiff / 7;

    const contentVariety = {
      text: contents.filter(c => c.type === 'text' || !c.media).length,
      image: contents.filter(c => c.media && c.media.type === 'image').length,
      video: contents.filter(c => c.media && c.media.type === 'video').length,
      carousel: contents.filter(c => c.type === 'carousel').length
    };

    return {
      postsCreated: contents.length,
      postsScheduled: contents.filter(c => c.status === 'scheduled').length,
      postsPublished: contents.filter(c => c.status === 'published').length,
      postsPerWeek: weeksDiff > 0 ? Math.round(contents.length / weeksDiff) : 0,
      postsPerMonth: daysDiff > 0 ? Math.round((contents.length / daysDiff) * 30) : 0,
      averagePostsPerDay: daysDiff > 0 ? Math.round((contents.length / daysDiff) * 10) / 10 : 0,
      contentVariety
    };
  } catch (error) {
    logger.error('Error getting content metrics', { error: error.message });
    return {
      postsCreated: 0,
      postsScheduled: 0,
      postsPublished: 0,
      postsPerWeek: 0,
      postsPerMonth: 0,
      averagePostsPerDay: 0,
      contentVariety: { text: 0, image: 0, video: 0, carousel: 0 }
    };
  }
}

/**
 * Get efficiency metrics
 */
async function getEfficiencyMetrics(userId, clientId, startDate, endDate) {
  try {
    // Get automation rules for this client
    const automationRules = await AutomationRule.find({
      userId,
      enabled: true
    }).lean();

    // Get execution stats
    const tasksAutomated = automationRules.reduce((sum, rule) => sum + (rule.stats.executions || 0), 0);
    
    // Estimate time saved (would calculate from actual automation)
    const averageTimePerPost = 30; // minutes (placeholder)
    const timeSaved = (tasksAutomated * averageTimePerPost) / 60; // hours

    // Get total tasks (would track actual tasks)
    const totalTasks = tasksAutomated + 10; // placeholder
    const automationRate = totalTasks > 0 ? (tasksAutomated / totalTasks) * 100 : 0;

    // Calculate efficiency score
    const efficiencyScore = calculateEfficiencyScore(automationRate, timeSaved);

    return {
      timeSaved: Math.round(timeSaved * 10) / 10,
      automationRate: Math.round(automationRate * 10) / 10,
      averageTimePerPost: averageTimePerPost,
      tasksAutomated,
      tasksManual: totalTasks - tasksAutomated,
      efficiencyScore: Math.round(efficiencyScore)
    };
  } catch (error) {
    logger.error('Error getting efficiency metrics', { error: error.message });
    return {
      timeSaved: 0,
      automationRate: 0,
      averageTimePerPost: 0,
      tasksAutomated: 0,
      tasksManual: 0,
      efficiencyScore: 0
    };
  }
}

/**
 * Calculate efficiency score
 */
function calculateEfficiencyScore(automationRate, timeSaved) {
  // Score based on automation rate (0-60 points) and time saved (0-40 points)
  const automationScore = Math.min(automationRate * 0.6, 60);
  const timeScore = Math.min((timeSaved / 10) * 40, 40); // 10 hours = 40 points
  return automationScore + timeScore;
}

/**
 * Get content gaps
 */
async function getContentGaps(userId, clientId, startDate, endDate) {
  try {
    // Get current content by platform
    const contents = await Content.find({
      userId,
      clientId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();

    // Get target posts (would come from client settings)
    const targetPostsPerPlatform = {
      twitter: 20,
      linkedin: 15,
      facebook: 10,
      instagram: 20,
      youtube: 5,
      tiktok: 15
    };

    const platformGaps = [];
    Object.entries(targetPostsPerPlatform).forEach(([platform, target]) => {
      const current = contents.filter(c => c.platform === platform).length;
      const gap = target - current;
      platformGaps.push({
        platform,
        currentPosts: current,
        targetPosts: target,
        gap: gap,
        gapPercentage: target > 0 ? Math.round((gap / target) * 100) : 0
      });
    });

    // Calculate overall gap score
    const totalGap = platformGaps.reduce((sum, p) => sum + Math.max(0, p.gap), 0);
    const totalTarget = platformGaps.reduce((sum, p) => sum + p.targetPosts, 0);
    const overallGapScore = totalTarget > 0 ? Math.round((totalGap / totalTarget) * 100) : 0;

    return {
      platforms: platformGaps,
      contentTypes: [], // Would calculate
      topics: [], // Would calculate
      overallGapScore
    };
  } catch (error) {
    logger.error('Error getting content gaps', { error: error.message });
    return {
      platforms: [],
      contentTypes: [],
      topics: [],
      overallGapScore: 0
    };
  }
}

/**
 * Get profit indicators
 */
async function getProfitIndicators(userId, clientId, startDate, endDate) {
  try {
    // Get client billing (would come from billing system)
    const revenue = 0; // placeholder
    
    // Calculate costs
    const contents = await Content.find({
      userId,
      clientId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).countDocuments();

    const hourlyRate = 50; // placeholder
    const averageTimePerPost = 0.5; // hours
    const timeSpent = contents * averageTimePerPost;
    const totalCost = timeSpent * hourlyRate;

    // Calculate value (would come from analytics)
    const valueGenerated = revenue * 1.5; // placeholder multiplier

    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const roi = totalCost > 0 ? ((profit - totalCost) / totalCost) * 100 : 0;
    const costPerPost = contents > 0 ? totalCost / contents : 0;
    const valuePerPost = contents > 0 ? valueGenerated / contents : 0;

    return {
      revenue,
      costs: {
        timeSpent: Math.round(timeSpent * 10) / 10,
        hourlyRate,
        totalCost: Math.round(totalCost * 10) / 10
      },
      profit: Math.round(profit * 10) / 10,
      profitMargin: Math.round(profitMargin * 10) / 10,
      roi: Math.round(roi * 10) / 10,
      valueGenerated: Math.round(valueGenerated * 10) / 10,
      costPerPost: Math.round(costPerPost * 10) / 10,
      valuePerPost: Math.round(valuePerPost * 10) / 10
    };
  } catch (error) {
    logger.error('Error getting profit indicators', { error: error.message });
    return {
      revenue: 0,
      costs: { timeSpent: 0, hourlyRate: 0, totalCost: 0 },
      profit: 0,
      profitMargin: 0,
      roi: 0,
      valueGenerated: 0,
      costPerPost: 0,
      valuePerPost: 0
    };
  }
}

/**
 * Calculate trends
 */
async function calculateTrends(userId, clientId, startDate, endDate) {
  try {
    // Get previous period for comparison
    const periodLength = endDate - startDate;
    const previousStart = new Date(startDate.getTime() - periodLength);
    const previousEnd = startDate;

    const current = await getContentMetrics(userId, clientId, startDate, endDate);
    const previous = await getContentMetrics(userId, clientId, previousStart, previousEnd);

    const postsTrend = current.postsCreated > previous.postsCreated ? 'increasing' :
                      current.postsCreated < previous.postsCreated ? 'decreasing' : 'stable';

    // Would calculate efficiency and profit trends similarly
    return {
      postsTrend,
      efficiencyTrend: 'stable', // placeholder
      profitTrend: 'stable' // placeholder
    };
  } catch (error) {
    logger.error('Error calculating trends', { error: error.message });
    return {
      postsTrend: 'stable',
      efficiencyTrend: 'stable',
      profitTrend: 'stable'
    };
  }
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

/**
 * Get aggregated dashboard for all clients
 */
async function getAggregatedDashboard(userId, period = 'month') {
  try {
    const { startDate, endDate } = getPeriodDates(period);
    
    const dashboards = await WorkloadDashboard.find({
      userId,
      'period.start': startDate,
      'period.end': endDate
    }).lean();

    if (dashboards.length === 0) {
      return {
        totalClients: 0,
        aggregated: null
      };
    }

    // Aggregate metrics
    const aggregated = {
      workload: {
        totalPosts: dashboards.reduce((sum, d) => sum + d.workload.postsCreated, 0),
        averagePostsPerClient: dashboards.length > 0 
          ? Math.round(dashboards.reduce((sum, d) => sum + d.workload.postsCreated, 0) / dashboards.length)
          : 0,
        totalPublished: dashboards.reduce((sum, d) => sum + d.workload.postsPublished, 0)
      },
      efficiency: {
        totalTimeSaved: dashboards.reduce((sum, d) => sum + d.efficiency.timeSaved, 0),
        averageAutomationRate: dashboards.length > 0
          ? Math.round(dashboards.reduce((sum, d) => sum + d.efficiency.automationRate, 0) / dashboards.length)
          : 0,
        averageEfficiencyScore: dashboards.length > 0
          ? Math.round(dashboards.reduce((sum, d) => sum + d.efficiency.efficiencyScore, 0) / dashboards.length)
          : 0
      },
      profit: {
        totalRevenue: dashboards.reduce((sum, d) => sum + d.profit.revenue, 0),
        totalCosts: dashboards.reduce((sum, d) => sum + d.profit.costs.totalCost, 0),
        totalProfit: dashboards.reduce((sum, d) => sum + d.profit.profit, 0),
        averageProfitMargin: dashboards.length > 0
          ? Math.round(dashboards.reduce((sum, d) => sum + d.profit.profitMargin, 0) / dashboards.length)
          : 0
      },
      contentGaps: {
        averageGapScore: dashboards.length > 0
          ? Math.round(dashboards.reduce((sum, d) => sum + d.contentGaps.overallGapScore, 0) / dashboards.length)
          : 0
      }
    };

    return {
      totalClients: dashboards.length,
      aggregated,
      period: { start: startDate, end: endDate, type: period }
    };
  } catch (error) {
    logger.error('Error getting aggregated dashboard', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getWorkloadDashboard,
  getAggregatedDashboard,
  calculateWorkloadDashboard
};



// KPI Dashboard Service
// Agency KPI dashboards with month-over-month tracking

const ClientValueTracking = require('../models/ClientValueTracking');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const Campaign = require('../models/Campaign');
const ClientServiceTier = require('../models/ClientServiceTier');
const logger = require('../utils/logger');

/**
 * Get agency KPI dashboard
 */
async function getAgencyKPIDashboard(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate = null,
      endDate = null,
      comparePeriod = true // Compare with previous period
    } = filters;

    // Calculate date ranges
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const periodStart = startDate ? new Date(startDate) : currentMonthStart;
    const periodEnd = endDate ? new Date(endDate) : currentMonthEnd;

    // Get all clients
    const Workspace = require('../models/Workspace');
    const clients = await Workspace.find({
      agencyWorkspaceId,
      type: 'client'
    }).lean();

    const clientIds = clients.map(c => c._id);

    // Get value tracking for current period
    const currentTracking = await ClientValueTracking.find({
      agencyWorkspaceId,
      'period.startDate': { $gte: periodStart, $lte: periodEnd }
    }).lean();

    // Get value tracking for previous period (if comparing)
    let previousTracking = [];
    if (comparePeriod) {
      previousTracking = await ClientValueTracking.find({
        agencyWorkspaceId,
        'period.startDate': { $gte: previousMonthStart, $lte: previousMonthEnd }
      }).lean();
    }

    // Calculate KPIs
    const kpis = {
      performance: {
        current: calculatePerformanceMetrics(currentTracking),
        previous: comparePeriod ? calculatePerformanceMetrics(previousTracking) : null,
        change: null
      },
      contentVelocity: {
        current: await calculateContentVelocity(clientIds, periodStart, periodEnd),
        previous: comparePeriod ? await calculateContentVelocity(clientIds, previousMonthStart, previousMonthEnd) : null,
        change: null
      },
      clients: {
        total: clients.length,
        active: currentTracking.length,
        byTier: await getClientsByTier(agencyWorkspaceId)
      },
      campaigns: {
        highlights: await getCampaignHighlights(agencyWorkspaceId, periodStart, periodEnd),
        active: await Campaign.countDocuments({
          agencyWorkspaceId,
          status: 'active'
        })
      },
      roi: {
        current: calculateROI(currentTracking),
        previous: comparePeriod ? calculateROI(previousTracking) : null,
        change: null
      }
    };

    // Calculate changes
    if (comparePeriod && kpis.performance.previous) {
      kpis.performance.change = calculateChange(kpis.performance.current, kpis.performance.previous);
      kpis.contentVelocity.change = calculateVelocityChange(kpis.contentVelocity.current, kpis.contentVelocity.previous);
      kpis.roi.change = calculateROIChange(kpis.roi.current, kpis.roi.previous);
    }

    return kpis;
  } catch (error) {
    logger.error('Error getting agency KPI dashboard', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Calculate performance metrics
 */
function calculatePerformanceMetrics(tracking) {
  const metrics = {
    totalImpressions: 0,
    totalEngagement: 0,
    totalLeads: 0,
    totalConversions: 0,
    totalRevenue: 0,
    averageROI: 0,
    totalClients: tracking.length
  };

  let totalROI = 0;
  tracking.forEach(record => {
    metrics.totalImpressions += record.value.impressions || 0;
    metrics.totalEngagement += record.value.engagement || 0;
    metrics.totalLeads += record.value.leads || 0;
    metrics.totalConversions += record.value.conversions || 0;
    metrics.totalRevenue += record.value.revenue || 0;
    totalROI += record.metrics.roi || 0;
  });

  if (tracking.length > 0) {
    metrics.averageROI = totalROI / tracking.length;
  }

  return metrics;
}

/**
 * Calculate content velocity
 */
async function calculateContentVelocity(clientIds, startDate, endDate) {
  try {
    const posts = await ScheduledPost.countDocuments({
      workspaceId: { $in: clientIds },
      scheduledTime: { $gte: startDate, $lte: endDate }
    });

    const content = await Content.countDocuments({
      workspaceId: { $in: clientIds },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const days = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const postsPerDay = days > 0 ? posts / days : 0;
    const contentPerDay = days > 0 ? content / days : 0;

    return {
      totalPosts: posts,
      totalContent: content,
      postsPerDay: Math.round(postsPerDay * 10) / 10,
      contentPerDay: Math.round(contentPerDay * 10) / 10,
      days
    };
  } catch (error) {
    logger.error('Error calculating content velocity', { error: error.message });
    return {
      totalPosts: 0,
      totalContent: 0,
      postsPerDay: 0,
      contentPerDay: 0,
      days: 0
    };
  }
}

/**
 * Get clients by tier
 */
async function getClientsByTier(agencyWorkspaceId) {
  try {
    const assignments = await ClientServiceTier.find({
      agencyWorkspaceId,
      status: 'active'
    }).lean();

    const byTier = {
      bronze: 0,
      silver: 0,
      gold: 0,
      custom: 0
    };

    assignments.forEach(assignment => {
      if (byTier.hasOwnProperty(assignment.tierName)) {
        byTier[assignment.tierName]++;
      } else {
        byTier.custom++;
      }
    });

    return byTier;
  } catch (error) {
    logger.error('Error getting clients by tier', { error: error.message });
    return { bronze: 0, silver: 0, gold: 0, custom: 0 };
  }
}

/**
 * Get campaign highlights
 */
async function getCampaignHighlights(agencyWorkspaceId, startDate, endDate) {
  try {
    const campaigns = await Campaign.find({
      agencyWorkspaceId,
      status: 'active',
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const highlights = await Promise.all(
      campaigns.map(async campaign => {
        const tracking = await ClientValueTracking.findOne({
          agencyWorkspaceId,
          campaignId: campaign._id,
          'period.startDate': { $gte: startDate, $lte: endDate }
        }).lean();

        return {
          campaignId: campaign._id,
          name: campaign.name,
          clientWorkspaceId: campaign.clientWorkspaceId,
          impressions: tracking?.value.impressions || 0,
          engagement: tracking?.value.engagement || 0,
          roi: tracking?.metrics.roi || 0,
          status: campaign.status
        };
      })
    );

    return highlights.sort((a, b) => b.roi - a.roi);
  } catch (error) {
    logger.error('Error getting campaign highlights', { error: error.message });
    return [];
  }
}

/**
 * Calculate ROI
 */
function calculateROI(tracking) {
  let totalCost = 0;
  let totalValue = 0;

  tracking.forEach(record => {
    totalCost += record.cost.total || 0;
    totalValue += (record.value.revenue || 0) + (record.value.timeSavedValue || 0);
  });

  const roi = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  return {
    totalCost,
    totalValue,
    roi: Math.round(roi * 10) / 10,
    netValue: totalValue - totalCost
  };
}

/**
 * Calculate change percentage
 */
function calculateChange(current, previous) {
  const changes = {};
  Object.keys(current).forEach(key => {
    if (typeof current[key] === 'number' && previous[key] !== undefined) {
      const change = previous[key] !== 0
        ? ((current[key] - previous[key]) / previous[key]) * 100
        : (current[key] > 0 ? 100 : 0);
      changes[key] = {
        value: current[key],
        previous: previous[key],
        change: Math.round(change * 10) / 10,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    }
  });
  return changes;
}

/**
 * Calculate velocity change
 */
function calculateVelocityChange(current, previous) {
  return {
    postsPerDay: {
      current: current.postsPerDay,
      previous: previous.postsPerDay,
      change: previous.postsPerDay !== 0
        ? ((current.postsPerDay - previous.postsPerDay) / previous.postsPerDay) * 100
        : (current.postsPerDay > 0 ? 100 : 0),
      trend: current.postsPerDay > previous.postsPerDay ? 'up' : current.postsPerDay < previous.postsPerDay ? 'down' : 'stable'
    },
    contentPerDay: {
      current: current.contentPerDay,
      previous: previous.contentPerDay,
      change: previous.contentPerDay !== 0
        ? ((current.contentPerDay - previous.contentPerDay) / previous.contentPerDay) * 100
        : (current.contentPerDay > 0 ? 100 : 0),
      trend: current.contentPerDay > previous.contentPerDay ? 'up' : current.contentPerDay < previous.contentPerDay ? 'down' : 'stable'
    }
  };
}

/**
 * Calculate ROI change
 */
function calculateROIChange(current, previous) {
  return {
    roi: {
      current: current.roi,
      previous: previous.roi,
      change: previous.roi !== 0
        ? ((current.roi - previous.roi) / Math.abs(previous.roi)) * 100
        : (current.roi > 0 ? 100 : 0),
      trend: current.roi > previous.roi ? 'up' : current.roi < previous.roi ? 'down' : 'stable'
    },
    netValue: {
      current: current.netValue,
      previous: previous.netValue,
      change: previous.netValue !== 0
        ? ((current.netValue - previous.netValue) / Math.abs(previous.netValue)) * 100
        : (current.netValue > 0 ? 100 : 0),
      trend: current.netValue > previous.netValue ? 'up' : current.netValue < previous.netValue ? 'down' : 'stable'
    }
  };
}

module.exports = {
  getAgencyKPIDashboard
};



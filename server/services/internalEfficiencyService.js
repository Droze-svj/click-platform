// Internal Efficiency Service
// Track time, FTE, utilization metrics

const InternalEfficiency = require('../models/InternalEfficiency');
const ScheduledPost = require('../models/ScheduledPost');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

/**
 * Calculate internal efficiency
 */
async function calculateInternalEfficiency(agencyWorkspaceId, period) {
  try {
    const {
      type = 'monthly',
      startDate,
      endDate
    } = period;

    // Get team size (would come from team management system)
    // For now, estimate from workspace data
    const workspace = await Workspace.findById(agencyWorkspaceId).lean();
    const teamSize = workspace?.teamSize || 1;

    // Get time tracking data (would come from time tracking system)
    // For now, estimate from posts
    const posts = await ScheduledPost.find({
      workspaceId: agencyWorkspaceId,
      status: { $in: ['posted', 'scheduled'] },
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();

    // Estimate time per post (would come from actual time tracking)
    const averageTimePerPost = 30; // Minutes
    const totalHours = (posts.length * averageTimePerPost) / 60;
    const billableHours = totalHours * 0.8; // 80% billable
    const nonBillableHours = totalHours * 0.2;

    // Get revenue (would come from billing system)
    const revenue = workspace?.monthlyRevenue || 0;

    // Get client workspaces
    const clientWorkspaces = await Workspace.find({
      parentWorkspace: agencyWorkspaceId,
      isClient: true
    }).lean();

    // Calculate per-client metrics
    const perClient = clientWorkspaces.map(client => {
      const clientPosts = posts.filter(p => p.workspaceId.toString() === client._id.toString());
      const clientHours = (clientPosts.length * averageTimePerPost) / 60;
      const clientRevenue = client.monthlyRevenue || 0;

      return {
        clientWorkspaceId: client._id,
        clientName: client.name,
        hours: Math.round(clientHours * 100) / 100,
        billableHours: Math.round(clientHours * 0.8 * 100) / 100,
        revenue: clientRevenue,
        revenuePerHour: clientHours > 0 ? Math.round((clientRevenue / clientHours) * 100) / 100 : 0
      };
    });

    // Calculate capacity (assuming 160 hours per month per FTE)
    const capacity = teamSize * 160;

    // Calculate utilization
    const utilizationRate = capacity > 0 ? (billableHours / capacity) * 100 : 0;

    // Create or update efficiency record
    const efficiency = await InternalEfficiency.findOneAndUpdate(
      {
        agencyWorkspaceId,
        'period.startDate': startDate,
        'period.endDate': endDate,
        'period.type': type
      },
      {
        $set: {
          agencyWorkspaceId,
          period: {
            type,
            startDate,
            endDate
          },
          team: {
            totalFTE: teamSize,
            activeFTE: teamSize,
            billableFTE: teamSize,
            utilizationRate: Math.round(utilizationRate * 100) / 100,
            capacity
          },
          time: {
            totalHours: Math.round(totalHours * 100) / 100,
            billableHours: Math.round(billableHours * 100) / 100,
            nonBillableHours: Math.round(nonBillableHours * 100) / 100,
            perClient,
            perActivity: [
              { activity: 'content_creation', hours: Math.round(totalHours * 0.6 * 100) / 100 },
              { activity: 'strategy', hours: Math.round(totalHours * 0.2 * 100) / 100 },
              { activity: 'client_communication', hours: Math.round(totalHours * 0.15 * 100) / 100 },
              { activity: 'admin', hours: Math.round(totalHours * 0.05 * 100) / 100 }
            ]
          },
          content: {
            totalPosts: posts.length,
            postsPerFTE: teamSize > 0 ? Math.round((posts.length / teamSize) * 100) / 100 : 0,
            postsPerHour: totalHours > 0 ? Math.round((posts.length / totalHours) * 100) / 100 : 0,
            averageTimePerPost,
            contentVelocity: 0 // Will be calculated by pre-save hook
          },
          revenue: {
            totalRevenue: revenue,
            revenuePerFTE: teamSize > 0 ? Math.round((revenue / teamSize) * 100) / 100 : 0,
            revenuePerHour: billableHours > 0 ? Math.round((revenue / billableHours) * 100) / 100 : 0,
            revenuePerClient: clientWorkspaces.length > 0 ? Math.round((revenue / clientWorkspaces.length) * 100) / 100 : 0,
            perClient
          },
          efficiency: {
            timeToRevenueRatio: totalHours > 0 ? Math.round((revenue / totalHours) * 100) / 100 : 0,
            costPerPost: posts.length > 0 ? Math.round((totalHours * 50 / posts.length) * 100) / 100 : 0, // $50/hour estimate
            profitMargin: 0, // Would calculate from costs
            efficiencyScore: 0 // Will be calculated by pre-save hook
          }
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Internal efficiency calculated', { agencyWorkspaceId, efficiencyScore: efficiency.efficiency.efficiencyScore });
    return efficiency;
  } catch (error) {
    logger.error('Error calculating internal efficiency', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get internal efficiency metrics
 */
async function getInternalEfficiencyMetrics(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      period = 'monthly'
    } = filters;

    const query = { agencyWorkspaceId, 'period.type': period };
    if (startDate || endDate) {
      query['period.startDate'] = {};
      if (startDate) query['period.startDate'].$gte = new Date(startDate);
      if (endDate) query['period.startDate'].$lte = new Date(endDate);
    }

    const efficiencies = await InternalEfficiency.find(query)
      .sort({ 'period.startDate': 1 })
      .lean();

    if (efficiencies.length === 0) {
      return {
        summary: null,
        trends: null,
        message: 'No efficiency data found'
      };
    }

    const latest = efficiencies[efficiencies.length - 1];

    // Calculate trends
    const trends = {
      utilizationRate: efficiencies.map(e => ({
        date: e.period.startDate,
        value: e.team.utilizationRate
      })),
      revenuePerFTE: efficiencies.map(e => ({
        date: e.period.startDate,
        value: e.revenue.revenuePerFTE
      })),
      postsPerFTE: efficiencies.map(e => ({
        date: e.period.startDate,
        value: e.content.postsPerFTE
      })),
      efficiencyScore: efficiencies.map(e => ({
        date: e.period.startDate,
        value: e.efficiency.efficiencyScore
      }))
    };

    return {
      summary: {
        current: latest,
        average: {
          utilizationRate: efficiencies.reduce((sum, e) => sum + e.team.utilizationRate, 0) / efficiencies.length,
          revenuePerFTE: efficiencies.reduce((sum, e) => sum + e.revenue.revenuePerFTE, 0) / efficiencies.length,
          postsPerFTE: efficiencies.reduce((sum, e) => sum + e.content.postsPerFTE, 0) / efficiencies.length,
          efficiencyScore: efficiencies.reduce((sum, e) => sum + e.efficiency.efficiencyScore, 0) / efficiencies.length
        }
      },
      trends,
      benchmarks: latest.benchmarks
    };
  } catch (error) {
    logger.error('Error getting internal efficiency metrics', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  calculateInternalEfficiency,
  getInternalEfficiencyMetrics
};



// Revenue Goal Service
// Track revenue goals and send alerts

const RevenueGoal = require('../models/RevenueGoal');
const RevenueAttribution = require('../models/RevenueAttribution');
const Conversion = require('../models/Conversion');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Create revenue goal
 */
async function createRevenueGoal(workspaceId, goalData) {
  try {
    const {
      name,
      description,
      targetRevenue,
      targetConversions = 0,
      targetROAS = 0,
      targetROI = 0,
      period,
      clientWorkspaceId = null,
      agencyWorkspaceId = null
    } = goalData;

    const goal = new RevenueGoal({
      workspaceId,
      clientWorkspaceId,
      agencyWorkspaceId,
      goal: {
        name,
        description,
        targetRevenue,
        targetConversions,
        targetROAS,
        targetROI
      },
      period: {
        type: period.type,
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate)
      },
      alerts: {
        enabled: true,
        thresholds: [
          { percentage: 25 },
          { percentage: 50 },
          { percentage: 75 },
          { percentage: 90 }
        ]
      }
    });

    await goal.save();
    logger.info('Revenue goal created', { goalId: goal._id, workspaceId });
    return goal;
  } catch (error) {
    logger.error('Error creating revenue goal', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Update revenue goal progress
 */
async function updateRevenueGoalProgress(goalId) {
  try {
    const goal = await RevenueGoal.findById(goalId).lean();
    if (!goal) {
      throw new Error('Revenue goal not found');
    }

    // Get actual performance
    const revenue = await RevenueAttribution.aggregate([
      {
        $match: {
          workspaceId: goal.workspaceId,
          'period.startDate': { $gte: goal.period.startDate },
          'period.endDate': { $lte: goal.period.endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue.attributed' },
          totalCosts: { $sum: '$costs.total' }
        }
      }
    ]);

    const conversions = await Conversion.countDocuments({
      workspaceId: goal.workspaceId,
      'conversionData.timestamp': {
        $gte: goal.period.startDate,
        $lte: goal.period.endDate
      }
    });

    const totalRevenue = revenue[0]?.totalRevenue || 0;
    const totalCosts = revenue[0]?.totalCosts || 0;
    const currentROAS = totalCosts > 0 ? totalRevenue / totalCosts : 0;
    const currentROI = totalCosts > 0 ? ((totalRevenue - totalCosts) / totalCosts) * 100 : 0;

    // Update progress
    await RevenueGoal.findByIdAndUpdate(goalId, {
      $set: {
        'progress.currentRevenue': totalRevenue,
        'progress.currentConversions': conversions,
        'progress.currentROAS': currentROAS,
        'progress.currentROI': currentROI,
        'progress.percentage': goal.goal.targetRevenue > 0 
          ? (totalRevenue / goal.goal.targetRevenue) * 100 
          : 0
      }
    });

    // Check alerts
    await checkGoalAlerts(goalId);

    const updatedGoal = await RevenueGoal.findById(goalId).lean();
    return updatedGoal;
  } catch (error) {
    logger.error('Error updating revenue goal progress', { error: error.message, goalId });
    throw error;
  }
}

/**
 * Check goal alerts
 */
async function checkGoalAlerts(goalId) {
  try {
    const goal = await RevenueGoal.findById(goalId).lean();
    if (!goal || !goal.alerts.enabled) {
      return;
    }

    const progress = goal.progress.percentage;

    // Check thresholds
    goal.alerts.thresholds.forEach(async (threshold) => {
      if (progress >= threshold.percentage && !threshold.triggered) {
        // Send notification
        const Workspace = require('../models/Workspace');
        const workspace = await Workspace.findById(goal.workspaceId).lean();
        const userId = workspace?.userId;

        if (userId) {
          try {
            NotificationService.notifyUser(userId.toString(), {
              type: 'revenue_goal_milestone',
              title: 'Revenue Goal Milestone!',
              message: `You've reached ${threshold.percentage}% of your revenue goal: ${goal.goal.name}`,
              data: {
                goalId: goalId.toString(),
                milestone: threshold.percentage,
                currentRevenue: goal.progress.currentRevenue,
                targetRevenue: goal.goal.targetRevenue
              }
            });
          } catch (error) {
            logger.warn('Error sending goal notification', { error: error.message });
          }
        }

        // Mark as triggered
        await RevenueGoal.findByIdAndUpdate(goalId, {
          $set: {
            'alerts.thresholds.$[elem].triggered': true,
            'alerts.thresholds.$[elem].triggeredAt': new Date()
          }
        }, {
          arrayFilters: [{ 'elem.percentage': threshold.percentage }]
        });
      }
    });

    // Check if at risk
    if (goal.status === 'at_risk' && !goal.progress.onTrack) {
      const Workspace = require('../models/Workspace');
      const workspace = await Workspace.findById(goal.workspaceId).lean();
      const userId = workspace?.userId;

      if (userId) {
        try {
          NotificationService.notifyUser(userId.toString(), {
            type: 'revenue_goal_at_risk',
            title: 'Revenue Goal At Risk',
            message: `Your revenue goal "${goal.goal.name}" is behind schedule. Current: ${progress.toFixed(1)}%`,
            data: {
              goalId: goalId.toString(),
              progress: progress,
              targetRevenue: goal.goal.targetRevenue
            }
          });
        } catch (error) {
          logger.warn('Error sending at-risk notification', { error: error.message });
        }
      }
    }
  } catch (error) {
    logger.error('Error checking goal alerts', { error: error.message, goalId });
  }
}

/**
 * Get revenue goals
 */
async function getRevenueGoals(workspaceId, filters = {}) {
  try {
    const {
      status = null,
      clientWorkspaceId = null,
      agencyWorkspaceId = null
    } = filters;

    const query = { workspaceId };
    if (status) query.status = status;
    if (clientWorkspaceId) query.clientWorkspaceId = clientWorkspaceId;
    if (agencyWorkspaceId) query.agencyWorkspaceId = agencyWorkspaceId;

    const goals = await RevenueGoal.find(query)
      .sort({ 'period.startDate': -1 })
      .lean();

    // Update progress for all goals
    for (const goal of goals) {
      await updateRevenueGoalProgress(goal._id);
    }

    // Re-fetch with updated progress
    const updatedGoals = await RevenueGoal.find(query)
      .sort({ 'period.startDate': -1 })
      .lean();

    return updatedGoals;
  } catch (error) {
    logger.error('Error getting revenue goals', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  createRevenueGoal,
  updateRevenueGoalProgress,
  getRevenueGoals
};



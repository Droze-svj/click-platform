// Benchmark Goal Service
// Manages benchmark-based goals

const BenchmarkGoal = require('../models/BenchmarkGoal');
const { benchmarkUserPerformance } = require('./contentBenchmarkingService');
const logger = require('../utils/logger');

/**
 * Create benchmark goal
 */
async function createBenchmarkGoal(userId, goalData) {
  try {
    const goal = new BenchmarkGoal({
      userId,
      name: goalData.name,
      platform: goalData.platform || 'all',
      metric: goalData.metric,
      targetValue: goalData.targetValue,
      endDate: new Date(goalData.endDate),
      milestones: goalData.milestones || []
    });

    await goal.save();
    logger.info('Benchmark goal created', { goalId: goal._id, userId });
    return goal;
  } catch (error) {
    logger.error('Error creating benchmark goal', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's goals
 */
async function getUserGoals(userId, status = null) {
  try {
    const query = { userId };
    if (status) {
      query.status = status;
    }

    const goals = await BenchmarkGoal.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return goals;
  } catch (error) {
    logger.error('Error getting user goals', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update goal progress
 */
async function updateGoalProgress(userId) {
  try {
    const goals = await BenchmarkGoal.find({
      userId,
      status: 'active'
    }).lean();

    // Get current user performance
    const userBenchmark = await benchmarkUserPerformance(userId, 30);

    if (!userBenchmark.hasData) {
      return { updated: 0 };
    }

    let updatedCount = 0;

    for (const goal of goals) {
      try {
        let currentValue = 0;

        if (goal.platform === 'all') {
          // Aggregate across all platforms
          const allMetrics = Object.values(userBenchmark.platformBenchmarks);
          if (goal.metric === 'engagement') {
            currentValue = allMetrics.reduce((sum, p) => sum + (p.metrics?.avgEngagement || 0), 0) / allMetrics.length;
          } else if (goal.metric === 'engagementRate') {
            currentValue = allMetrics.reduce((sum, p) => sum + (p.metrics?.avgEngagementRate || 0), 0) / allMetrics.length;
          } else if (goal.metric === 'percentile') {
            currentValue = userBenchmark.overallScore.score;
          }
        } else {
          const platformData = userBenchmark.platformBenchmarks[goal.platform];
          if (platformData) {
            if (goal.metric === 'engagement') {
              currentValue = platformData.metrics.avgEngagement;
            } else if (goal.metric === 'engagementRate') {
              currentValue = platformData.metrics.avgEngagementRate;
            } else if (goal.metric === 'percentile') {
              currentValue = platformData.percentiles.engagement.percentile;
            }
          }
        }

        // Update goal
        const updatedGoal = await BenchmarkGoal.findByIdAndUpdate(
          goal._id,
          { currentValue },
          { new: true }
        );

        // Check milestones
        if (updatedGoal.milestones && updatedGoal.milestones.length > 0) {
          for (const milestone of updatedGoal.milestones) {
            if (!milestone.achieved && currentValue >= milestone.value) {
              milestone.achieved = true;
              milestone.achievedAt = new Date();
              await BenchmarkGoal.findByIdAndUpdate(goal._id, {
                milestones: updatedGoal.milestones
              });
            }
          }
        }

        updatedCount++;
      } catch (error) {
        logger.error('Error updating goal', { error: error.message, goalId: goal._id });
      }
    }

    return { updated: updatedCount };
  } catch (error) {
    logger.error('Error updating goal progress', { error: error.message, userId });
    throw error;
  }
}

/**
 * Delete goal
 */
async function deleteGoal(goalId, userId) {
  try {
    const goal = await BenchmarkGoal.findOneAndDelete({
      _id: goalId,
      userId
    });

    if (!goal) {
      throw new Error('Goal not found');
    }

    return goal;
  } catch (error) {
    logger.error('Error deleting goal', { error: error.message, goalId });
    throw error;
  }
}

module.exports = {
  createBenchmarkGoal,
  getUserGoals,
  updateGoalProgress,
  deleteGoal
};



// AI Music Cost Tracking Service
// Tracks generation costs and usage

const logger = require('../utils/logger');
const MusicGeneration = require('../models/MusicGeneration');
const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');

/**
 * Cost configuration per provider
 */
const COST_CONFIG = {
  mubert: {
    perGeneration: 0.10, // $0.10 per generation (example)
    monthlyUnlimited: 99.00, // $99/month for unlimited
    hasUnlimitedPlan: true
  },
  soundraw: {
    perGeneration: 0.05, // $0.05 per generation (example)
    monthlyUnlimited: 49.00,
    hasUnlimitedPlan: true
  }
};

/**
 * Track generation cost
 */
async function trackGenerationCost(generationId, provider, cost) {
  try {
    await MusicGeneration.findByIdAndUpdate(generationId, {
      $set: {
        'metadata.cost': cost,
        'metadata.costTrackedAt': new Date()
      }
    });

    // Update provider usage
    await AIMusicProviderConfig.findOneAndUpdate(
      { provider },
      {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() }
      }
    );

    logger.info('Generation cost tracked', { generationId, provider, cost });
  } catch (error) {
    logger.error('Error tracking generation cost', {
      error: error.message,
      generationId,
      provider
    });
  }
}

/**
 * Calculate cost for generation
 */
function calculateGenerationCost(provider, hasUnlimitedPlan = false) {
  if (hasUnlimitedPlan) {
    return 0; // No per-generation cost if unlimited plan
  }

  const config = COST_CONFIG[provider];
  if (!config) {
    return 0; // Unknown provider
  }

  return config.perGeneration || 0;
}

/**
 * Get cost statistics
 */
async function getCostStatistics(options = {}) {
  const {
    startDate,
    endDate,
    provider,
    userId
  } = options;

  try {
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    if (provider) matchStage.provider = provider;
    if (userId) matchStage.userId = userId;

    // Get generations with costs
    const generations = await MusicGeneration.find(matchStage)
      .select('provider metadata.cost createdAt')
      .lean();

    // Calculate statistics
    const providerStats = {};
    let totalCost = 0;
    let totalGenerations = 0;

    generations.forEach(gen => {
      const cost = gen.metadata?.cost || 0;
      totalCost += cost;
      totalGenerations++;

      if (!providerStats[gen.provider]) {
        providerStats[gen.provider] = {
          provider: gen.provider,
          count: 0,
          totalCost: 0,
          averageCost: 0
        };
      }

      providerStats[gen.provider].count++;
      providerStats[gen.provider].totalCost += cost;
    });

    // Calculate averages
    Object.values(providerStats).forEach(stats => {
      stats.averageCost = stats.count > 0 ? stats.totalCost / stats.count : 0;
    });

    return {
      totalGenerations,
      totalCost,
      averageCostPerGeneration: totalGenerations > 0 ? totalCost / totalGenerations : 0,
      providerBreakdown: Object.values(providerStats),
      estimatedMonthlyCost: estimateMonthlyCost(totalCost, generations.length)
    };
  } catch (error) {
    logger.error('Error getting cost statistics', { error: error.message });
    throw error;
  }
}

/**
 * Estimate monthly cost based on current usage
 */
function estimateMonthlyCost(totalCost, generationCount) {
  if (generationCount === 0) return 0;

  // Estimate based on average daily usage
  const days = 30; // Assume 30-day period
  const dailyAverage = totalCost / days;
  const monthlyEstimate = dailyAverage * 30;

  return monthlyEstimate;
}

/**
 * Get cost breakdown by user
 */
async function getCostBreakdownByUser(options = {}) {
  const {
    startDate,
    endDate,
    limit = 10
  } = options;

  try {
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const userStats = await MusicGeneration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalCost: { $sum: '$metadata.cost' },
          generationCount: { $sum: 1 }
        }
      },
      { $sort: { totalCost: -1 } },
      { $limit: limit }
    ]);

    return userStats.map(stat => ({
      userId: stat._id,
      totalCost: stat.totalCost || 0,
      generationCount: stat.generationCount,
      averageCost: stat.generationCount > 0 
        ? (stat.totalCost || 0) / stat.generationCount 
        : 0
    }));
  } catch (error) {
    logger.error('Error getting cost breakdown by user', { error: error.message });
    throw error;
  }
}

module.exports = {
  trackGenerationCost,
  calculateGenerationCost,
  getCostStatistics,
  estimateMonthlyCost,
  getCostBreakdownByUser,
  COST_CONFIG
};








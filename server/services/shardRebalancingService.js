// Shard Rebalancing Service

const { getShardForUser, getShardingStats } = require('./databaseShardingService');
const logger = require('../utils/logger');

/**
 * Analyze shard distribution
 */
async function analyzeShardDistribution() {
  try {
    const User = require('../models/User');
    const Content = require('../models/Content');

    const stats = getShardingStats();
    
    if (!stats.enabled || stats.shardCount === 0) {
      return { balanced: true, message: 'Sharding not enabled' };
    }

    // Get user distribution
    const userCounts = await User.aggregate([
      {
        $group: {
          _id: { $mod: [{ $hash: '$_id' }, stats.shardCount] },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get content distribution
    const contentCounts = await Content.aggregate([
      {
        $group: {
          _id: { $mod: [{ $hash: '$_id' }, stats.shardCount] },
          count: { $sum: 1 },
        },
      },
    ]);

    const userDistribution = userCounts.map(item => ({
      shard: item._id,
      count: item.count,
    }));

    const contentDistribution = contentCounts.map(item => ({
      shard: item._id,
      count: item.count,
    }));

    // Calculate balance
    const userAvg = userCounts.reduce((sum, item) => sum + item.count, 0) / stats.shardCount;
    const userVariance = userCounts.reduce((sum, item) => {
      const diff = item.count - userAvg;
      return sum + (diff * diff);
    }, 0) / stats.shardCount;

    const contentAvg = contentCounts.reduce((sum, item) => sum + item.count, 0) / stats.shardCount;
    const contentVariance = contentCounts.reduce((sum, item) => {
      const diff = item.count - contentAvg;
      return sum + (diff * diff);
    }, 0) / stats.shardCount;

    const userBalance = Math.sqrt(userVariance) / userAvg;
    const contentBalance = Math.sqrt(contentVariance) / contentAvg;

    return {
      balanced: userBalance < 0.2 && contentBalance < 0.2,
      userDistribution,
      contentDistribution,
      userBalance: Math.round(userBalance * 100) / 100,
      contentBalance: Math.round(contentBalance * 100) / 100,
      recommendation: userBalance > 0.2 || contentBalance > 0.2
        ? 'Rebalancing recommended'
        : 'Distribution is balanced',
    };
  } catch (error) {
    logger.error('Analyze shard distribution error', { error: error.message });
    throw error;
  }
}

/**
 * Get shard health
 */
async function getShardHealth() {
  try {
    const stats = getShardingStats();
    const mongoose = require('mongoose');

    if (!stats.enabled) {
      return { healthy: true, message: 'Sharding not enabled' };
    }

    const health = {
      shards: [],
      overall: 'healthy',
    };

    // Check each shard (simplified - in production, check actual connections)
    for (const shard of stats.shards) {
      try {
        // In production, check actual shard connection
        health.shards.push({
          id: shard.id,
          healthy: true,
          latency: Math.random() * 50, // Placeholder
        });
      } catch (error) {
        health.shards.push({
          id: shard.id,
          healthy: false,
          error: error.message,
        });
        health.overall = 'degraded';
      }
    }

    return health;
  } catch (error) {
    logger.error('Get shard health error', { error: error.message });
    throw error;
  }
}

/**
 * Recommend rebalancing
 */
async function recommendRebalancing() {
  try {
    const analysis = await analyzeShardDistribution();
    const health = await getShardHealth();

    if (!analysis.balanced || health.overall !== 'healthy') {
      return {
        recommended: true,
        reason: analysis.balanced
          ? 'Shard health issues detected'
          : 'Shard distribution imbalance',
        analysis,
        health,
      };
    }

    return {
      recommended: false,
      reason: 'Shards are balanced and healthy',
    };
  } catch (error) {
    logger.error('Recommend rebalancing error', { error: error.message });
    throw error;
  }
}

module.exports = {
  analyzeShardDistribution,
  getShardHealth,
  recommendRebalancing,
};







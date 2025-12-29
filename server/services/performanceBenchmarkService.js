// Performance Benchmark Service
// Compare performance against industry benchmarks

const PerformanceBenchmark = require('../models/PerformanceBenchmark');
const ScheduledPost = require('../models/ScheduledPost');
const AudienceGrowth = require('../models/AudienceGrowth');
const { getAggregatedPerformanceMetrics } = require('./socialPerformanceMetricsService');
const logger = require('../utils/logger');

/**
 * Get or create benchmark
 */
async function getBenchmark(industry, platform, niche = null) {
  try {
    const query = { industry, platform };
    if (niche) query.niche = niche;

    let benchmark = await PerformanceBenchmark.findOne(query).lean();

    // If no benchmark exists, create default based on industry standards
    if (!benchmark) {
      benchmark = await createDefaultBenchmark(industry, platform, niche);
    }

    return benchmark;
  } catch (error) {
    logger.error('Error getting benchmark', { error: error.message, industry, platform });
    throw error;
  }
}

/**
 * Create default benchmark based on industry standards
 */
async function createDefaultBenchmark(industry, platform, niche) {
  // Industry-standard benchmarks (would be populated from real data in production)
  const defaultBenchmarks = {
    saas: {
      linkedin: { engagementRate: 2.5, growthRate: 1.2 },
      twitter: { engagementRate: 1.8, growthRate: 0.8 }
    },
    ecommerce: {
      instagram: { engagementRate: 3.5, growthRate: 2.5 },
      facebook: { engagementRate: 2.0, growthRate: 1.5 }
    },
    creator: {
      tiktok: { engagementRate: 5.0, growthRate: 3.0 },
      instagram: { engagementRate: 4.0, growthRate: 2.5 }
    }
  };

  const industryDefaults = defaultBenchmarks[industry.toLowerCase()] || defaultBenchmarks.saas;
  const platformDefaults = industryDefaults[platform] || { engagementRate: 2.0, growthRate: 1.0 };

  const benchmark = new PerformanceBenchmark({
    industry,
    niche,
    platform,
    metrics: {
      averageEngagementRate: {
        byReach: platformDefaults.engagementRate,
        byImpressions: platformDefaults.engagementRate * 0.8,
        byFollowers: platformDefaults.engagementRate * 0.6
      },
      averageGrowthRate: platformDefaults.growthRate,
      averageChurnRate: platformDefaults.growthRate * 0.3
    },
    percentiles: {
      p25: {
        engagementRate: platformDefaults.engagementRate * 0.6,
        growthRate: platformDefaults.growthRate * 0.5
      },
      p50: {
        engagementRate: platformDefaults.engagementRate,
        growthRate: platformDefaults.growthRate
      },
      p75: {
        engagementRate: platformDefaults.engagementRate * 1.5,
        growthRate: platformDefaults.growthRate * 1.5
      },
      p90: {
        engagementRate: platformDefaults.engagementRate * 2.0,
        growthRate: platformDefaults.growthRate * 2.0
      }
    },
    sampleSize: 1000 // Placeholder
  });

  await benchmark.save();
  return benchmark;
}

/**
 * Compare performance against benchmark
 */
async function compareAgainstBenchmark(workspaceId, platform, filters = {}) {
  try {
    const {
      industry = 'general',
      niche = null
    } = filters;

    // Get benchmark
    const benchmark = await getBenchmark(industry, platform, niche);

    // Get actual performance
    const metrics = await getAggregatedPerformanceMetrics(workspaceId, {
      platform,
      ...filters
    });

    // Get audience growth
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(workspaceId).lean();
    const userId = workspace?.userId;

    let growthRate = 0;
    if (userId) {
      const growth = await AudienceGrowth.findOne({
        userId,
        platform
      })
        .sort({ snapshotDate: -1 })
        .lean();

      if (growth) {
        growthRate = growth.growth.growthRate || 0;
      }
    }

    // Calculate comparison
    const comparison = {
      engagementRate: {
        actual: metrics.averageEngagementRate.byReach || 0,
        benchmark: benchmark.metrics.averageEngagementRate.byReach,
        difference: (metrics.averageEngagementRate.byReach || 0) - benchmark.metrics.averageEngagementRate.byReach,
        percentile: calculatePercentile(
          metrics.averageEngagementRate.byReach || 0,
          benchmark.percentiles
        ),
        status: getPerformanceStatus(
          metrics.averageEngagementRate.byReach || 0,
          benchmark.metrics.averageEngagementRate.byReach
        )
      },
      growthRate: {
        actual: growthRate,
        benchmark: benchmark.metrics.averageGrowthRate,
        difference: growthRate - benchmark.metrics.averageGrowthRate,
        percentile: calculatePercentile(growthRate, benchmark.percentiles, 'growthRate'),
        status: getPerformanceStatus(growthRate, benchmark.metrics.averageGrowthRate)
      },
      reach: {
        actual: metrics.totalReach / Math.max(metrics.totalPosts, 1),
        benchmark: benchmark.metrics.averageReach,
        status: 'info' // Informational only
      }
    };

    return {
      benchmark,
      metrics,
      comparison,
      recommendations: generateRecommendations(comparison, benchmark)
    };
  } catch (error) {
    logger.error('Error comparing against benchmark', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Calculate percentile
 */
function calculatePercentile(value, percentiles, metric = 'engagementRate') {
  if (value >= percentiles.p90[metric]) return 90;
  if (value >= percentiles.p75[metric]) return 75;
  if (value >= percentiles.p50[metric]) return 50;
  if (value >= percentiles.p25[metric]) return 25;
  return 10;
}

/**
 * Get performance status
 */
function getPerformanceStatus(actual, benchmark) {
  const ratio = benchmark > 0 ? actual / benchmark : 0;
  if (ratio >= 1.2) return 'excellent';
  if (ratio >= 1.0) return 'good';
  if (ratio >= 0.8) return 'average';
  if (ratio >= 0.6) return 'below_average';
  return 'poor';
}

/**
 * Generate recommendations
 */
function generateRecommendations(comparison, benchmark) {
  const recommendations = [];

  if (comparison.engagementRate.status === 'poor' || comparison.engagementRate.status === 'below_average') {
    recommendations.push({
      type: 'engagement',
      priority: 'high',
      message: 'Engagement rate is below benchmark',
      suggestions: [
        'Improve content quality and relevance',
        'Post at optimal times',
        'Use more engaging formats (videos, carousels)',
        'Increase interaction with audience'
      ]
    });
  }

  if (comparison.growthRate.status === 'poor' || comparison.growthRate.status === 'below_average') {
    recommendations.push({
      type: 'growth',
      priority: 'high',
      message: 'Growth rate is below benchmark',
      suggestions: [
        'Increase posting frequency',
        'Focus on high-performing content types',
        'Engage with trending topics',
        'Collaborate with other creators'
      ]
    });
  }

  if (comparison.engagementRate.percentile >= 75) {
    recommendations.push({
      type: 'optimization',
      priority: 'low',
      message: 'Excellent engagement rate - optimize further',
      suggestions: [
        'Double down on what\'s working',
        'Increase posting frequency of top-performing content',
        'Expand to similar topics/formats'
      ]
    });
  }

  return recommendations;
}

/**
 * Predict future performance
 */
async function predictPerformance(workspaceId, platform, days = 30) {
  try {
    // Get historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Last 90 days

    const metrics = await getAggregatedPerformanceMetrics(workspaceId, {
      platform,
      startDate,
      endDate
    });

    // Get growth trends
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(workspaceId).lean();
    const userId = workspace?.userId;

    let growthTrend = 0;
    if (userId) {
      const growth = await AudienceGrowth.find({
        userId,
        platform,
        snapshotDate: { $gte: startDate, $lte: endDate }
      })
        .sort({ snapshotDate: 1 })
        .lean();

      if (growth.length >= 2) {
        const first = growth[0];
        const last = growth[growth.length - 1];
        const daysDiff = (last.snapshotDate - first.snapshotDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 0) {
          growthTrend = ((last.followers.current - first.followers.current) / daysDiff) * 7; // Weekly growth
        }
      }
    }

    // Calculate predictions
    const currentEngagementRate = metrics.averageEngagementRate.byReach || 0;
    const currentGrowthRate = growthTrend;

    const prediction = {
      engagementRate: {
        current: currentEngagementRate,
        predicted: currentEngagementRate * 1.05, // Slight improvement assumption
        confidence: 70
      },
      growthRate: {
        current: currentGrowthRate,
        predicted: currentGrowthRate * 1.1, // Growth assumption
        confidence: 65
      },
      followers: {
        current: 0, // Would get from latest snapshot
        predicted: 0, // Would calculate based on growth rate
        confidence: 60
      },
      period: {
        startDate: new Date(),
        endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      }
    };

    // Get current followers if available
    if (userId) {
      const latestGrowth = await AudienceGrowth.findOne({
        userId,
        platform
      })
        .sort({ snapshotDate: -1 })
        .lean();

      if (latestGrowth) {
        prediction.followers.current = latestGrowth.followers.current;
        prediction.followers.predicted = Math.round(
          latestGrowth.followers.current + (currentGrowthRate * days / 7)
        );
      }
    }

    return prediction;
  } catch (error) {
    logger.error('Error predicting performance', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  getBenchmark,
  compareAgainstBenchmark,
  predictPerformance
};



// Competitor Benchmark Service
// Benchmark against competitors and industry

const CompetitorBenchmark = require('../models/CompetitorBenchmark');
const ScheduledPost = require('../models/ScheduledPost');
const ContentPerformance = require('../models/ContentPerformance');
const AudienceGrowth = require('../models/AudienceGrowth');
const { getAggregatedPerformanceMetrics } = require('./socialPerformanceMetricsService');
const logger = require('../utils/logger');

/**
 * Create or update competitor benchmark
 */
async function updateCompetitorBenchmark(workspaceId, platform, period, competitorData) {
  try {
    const {
      startDate,
      endDate,
      type = 'monthly'
    } = period;

    // Get our metrics
    const ourMetrics = await getOurMetrics(workspaceId, platform, startDate, endDate);

    // Get industry benchmark
    const industryBenchmark = await getIndustryBenchmark(platform);

    // Create or update benchmark
    const benchmark = await CompetitorBenchmark.findOneAndUpdate(
      {
        workspaceId,
        platform,
        'period.startDate': startDate,
        'period.endDate': endDate,
        'period.type': type
      },
      {
        $set: {
          workspaceId,
          platform,
          period: {
            type,
            startDate,
            endDate
          },
          competitors: competitorData.competitors || [],
          ourMetrics,
          industryBenchmark: {
            ...industryBenchmark,
            ourVsIndustry: {
              engagementRate: ourMetrics.engagementRate > 0 && industryBenchmark.averageEngagementRate > 0
                ? ((ourMetrics.engagementRate - industryBenchmark.averageEngagementRate) / industryBenchmark.averageEngagementRate) * 100
                : 0,
              reach: ourMetrics.reach > 0 && industryBenchmark.averageReach > 0
                ? ((ourMetrics.reach - industryBenchmark.averageReach) / industryBenchmark.averageReach) * 100
                : 0,
              followers: ourMetrics.followers > 0 && industryBenchmark.averageFollowers > 0
                ? ((ourMetrics.followers - industryBenchmark.averageFollowers) / industryBenchmark.averageFollowers) * 100
                : 0
            }
          }
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Competitor benchmark updated', { workspaceId, platform, percentile: benchmark.comparison.percentile });
    return benchmark;
  } catch (error) {
    logger.error('Error updating competitor benchmark', { error: error.message, workspaceId, platform });
    throw error;
  }
}

/**
 * Get our metrics
 */
async function getOurMetrics(workspaceId, platform, startDate, endDate) {
  const metrics = await getAggregatedPerformanceMetrics(workspaceId, {
    platform,
    startDate,
    endDate
  });

  // Get followers
  const Workspace = require('../models/Workspace');
  const workspace = await Workspace.findById(workspaceId).lean();
  const userId = workspace?.userId;

  let followers = 0;
  if (userId) {
    const growth = await AudienceGrowth.findOne({
      userId,
      platform
    })
      .sort({ snapshotDate: -1 })
      .lean();

    followers = growth?.followers.current || 0;
  }

  // Get post count
  const posts = await ScheduledPost.countDocuments({
    workspaceId,
    platform,
    status: 'posted',
    postedAt: { $gte: startDate, $lte: endDate }
  });

  // Calculate engagement rate
  const engagementRate = metrics.totalReach > 0
    ? (metrics.totalEngagement / metrics.totalReach) * 100
    : 0;

  return {
    followers,
    engagement: metrics.totalEngagement,
    reach: metrics.totalReach,
    posts,
    engagementRate
  };
}

/**
 * Get industry benchmark
 */
async function getIndustryBenchmark(platform) {
  // Industry benchmarks (would be populated from real data in production)
  const benchmarks = {
    twitter: {
      averageEngagementRate: 1.5,
      averageReach: 10000,
      averageFollowers: 5000
    },
    linkedin: {
      averageEngagementRate: 2.5,
      averageReach: 5000,
      averageFollowers: 3000
    },
    instagram: {
      averageEngagementRate: 3.5,
      averageReach: 15000,
      averageFollowers: 8000
    },
    facebook: {
      averageEngagementRate: 2.0,
      averageReach: 12000,
      averageFollowers: 6000
    },
    youtube: {
      averageEngagementRate: 4.0,
      averageReach: 20000,
      averageFollowers: 10000
    },
    tiktok: {
      averageEngagementRate: 5.0,
      averageReach: 25000,
      averageFollowers: 12000
    }
  };

  return benchmarks[platform] || {
    averageEngagementRate: 2.5,
    averageReach: 10000,
    averageFollowers: 5000
  };
}

/**
 * Get benchmark comparison
 */
async function getBenchmarkComparison(workspaceId, platform, period) {
  try {
    const {
      startDate,
      endDate,
      type = 'monthly'
    } = period;

    const benchmark = await CompetitorBenchmark.findOne({
      workspaceId,
      platform,
      'period.startDate': startDate,
      'period.endDate': endDate,
      'period.type': type
    }).lean();

    if (!benchmark) {
      throw new Error('Benchmark not found. Run updateCompetitorBenchmark first.');
    }

    // Get previous period for comparison
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(endDate);
    if (type === 'monthly') {
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
      prevEndDate.setMonth(prevEndDate.getMonth() - 1);
    }

    const previousBenchmark = await CompetitorBenchmark.findOne({
      workspaceId,
      platform,
      'period.startDate': prevStartDate,
      'period.endDate': prevEndDate,
      'period.type': type
    }).lean();

    const comparison = {
      current: benchmark,
      previous: previousBenchmark,
      monthOverMonth: {
        engagementRateChange: previousBenchmark
          ? ((benchmark.ourMetrics.engagementRate - previousBenchmark.ourMetrics.engagementRate) / previousBenchmark.ourMetrics.engagementRate) * 100
          : 0,
        reachChange: previousBenchmark
          ? ((benchmark.ourMetrics.reach - previousBenchmark.ourMetrics.reach) / previousBenchmark.ourMetrics.reach) * 100
          : 0,
        followersChange: previousBenchmark
          ? ((benchmark.ourMetrics.followers - previousBenchmark.ourMetrics.followers) / previousBenchmark.ourMetrics.followers) * 100
          : 0
      },
      vsCompetitors: {
        rank: benchmark.comparison.averageRank,
        percentile: benchmark.comparison.percentile,
        bestMetric: getBestMetric(benchmark),
        worstMetric: getWorstMetric(benchmark)
      },
      vsIndustry: benchmark.industryBenchmark.ourVsIndustry
    };

    return comparison;
  } catch (error) {
    logger.error('Error getting benchmark comparison', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get best metric
 */
function getBestMetric(benchmark) {
  const ranks = {
    followers: benchmark.comparison.followersRank,
    engagement: benchmark.comparison.engagementRank,
    reach: benchmark.comparison.reachRank,
    engagementRate: benchmark.comparison.engagementRateRank
  };

  const best = Object.entries(ranks)
    .filter(([_, rank]) => rank !== null)
    .sort((a, b) => a[1] - b[1])[0];

  return best ? { metric: best[0], rank: best[1] } : null;
}

/**
 * Get worst metric
 */
function getWorstMetric(benchmark) {
  const ranks = {
    followers: benchmark.comparison.followersRank,
    engagement: benchmark.comparison.engagementRank,
    reach: benchmark.comparison.reachRank,
    engagementRate: benchmark.comparison.engagementRateRank
  };

  const worst = Object.entries(ranks)
    .filter(([_, rank]) => rank !== null)
    .sort((a, b) => b[1] - a[1])[0];

  return worst ? { metric: worst[0], rank: worst[1] } : null;
}

module.exports = {
  updateCompetitorBenchmark,
  getBenchmarkComparison
};



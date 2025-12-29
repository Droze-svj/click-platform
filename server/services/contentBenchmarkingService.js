// Content Performance Benchmarking Service
// Compares content performance against industry standards and competitors

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Industry benchmark data (in production, this would come from external APIs or databases)
 */
const INDUSTRY_BENCHMARKS = {
  twitter: {
    engagement: { p25: 50, p50: 150, p75: 400, p90: 1000 },
    engagementRate: { p25: 1.0, p50: 2.5, p75: 5.0, p90: 10.0 },
    impressions: { p25: 500, p50: 2000, p75: 5000, p90: 15000 }
  },
  linkedin: {
    engagement: { p25: 20, p50: 75, p75: 200, p90: 500 },
    engagementRate: { p25: 2.0, p50: 4.0, p75: 8.0, p90: 15.0 },
    impressions: { p25: 200, p50: 1000, p75: 3000, p90: 8000 }
  },
  facebook: {
    engagement: { p25: 30, p50: 100, p75: 300, p90: 800 },
    engagementRate: { p25: 1.5, p50: 3.0, p75: 6.0, p90: 12.0 },
    impressions: { p25: 500, p50: 2000, p75: 6000, p90: 15000 }
  },
  instagram: {
    engagement: { p25: 100, p50: 300, p75: 800, p90: 2000 },
    engagementRate: { p25: 2.5, p50: 5.0, p75: 10.0, p90: 20.0 },
    impressions: { p25: 1000, p50: 5000, p75: 15000, p90: 40000 }
  },
  youtube: {
    engagement: { p25: 50, p50: 200, p75: 600, p90: 2000 },
    engagementRate: { p25: 1.0, p50: 2.0, p75: 4.0, p90: 8.0 },
    views: { p25: 100, p50: 500, p75: 2000, p90: 10000 }
  },
  tiktok: {
    engagement: { p25: 200, p50: 800, p75: 3000, p90: 10000 },
    engagementRate: { p25: 3.0, p50: 6.0, p75: 12.0, p90: 25.0 },
    views: { p25: 500, p50: 2000, p75: 10000, p90: 50000 }
  }
};

/**
 * Calculate percentile for a value
 */
function calculatePercentile(value, benchmarks) {
  if (!benchmarks || value === null || value === undefined) {
    return { percentile: 0, label: 'N/A' };
  }

  if (value >= benchmarks.p90) {
    return { percentile: 90, label: 'Top 10%' };
  } else if (value >= benchmarks.p75) {
    return { percentile: 75, label: 'Top 25%' };
  } else if (value >= benchmarks.p50) {
    return { percentile: 50, label: 'Top 50%' };
  } else if (value >= benchmarks.p25) {
    return { percentile: 25, label: 'Bottom 50%' };
  } else {
    return { percentile: 10, label: 'Bottom 25%' };
  }
}

/**
 * Benchmark content performance
 */
async function benchmarkContentPerformance(userId, contentId, platform = null) {
  try {
    const content = await Content.findOne({
      _id: contentId,
      userId
    }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    // Get all posts for this content
    const posts = await ScheduledPost.find({
      userId,
      contentId: content._id,
      status: 'posted'
    }).lean();

    if (posts.length === 0) {
      return {
        contentId,
        hasData: false,
        message: 'No posted content available for benchmarking'
      };
    }

    // Calculate aggregate metrics
    const metrics = calculateAggregateMetrics(posts, platform);

    // Get benchmarks for each platform
    const benchmarks = {};
    const platformMetrics = {};

    // Group by platform
    const postsByPlatform = {};
    posts.forEach(post => {
      if (!postsByPlatform[post.platform]) {
        postsByPlatform[post.platform] = [];
      }
      postsByPlatform[post.platform].push(post);
    });

    // Benchmark each platform
    for (const [platformName, platformPosts] of Object.entries(postsByPlatform)) {
      const platformBenchmarks = INDUSTRY_BENCHMARKS[platformName];
      if (!platformBenchmarks) continue;

      const platformMetrics = calculatePlatformMetrics(platformPosts);
      const engagementPercentile = calculatePercentile(
        platformMetrics.avgEngagement,
        platformBenchmarks.engagement
      );
      const engagementRatePercentile = calculatePercentile(
        platformMetrics.avgEngagementRate,
        platformBenchmarks.engagementRate
      );
      const impressionsPercentile = calculatePercentile(
        platformMetrics.avgImpressions,
        platformBenchmarks.impressions || platformBenchmarks.views
      );

      benchmarks[platformName] = {
        metrics: platformMetrics,
        percentiles: {
          engagement: engagementPercentile,
          engagementRate: engagementRatePercentile,
          impressions: impressionsPercentile
        },
        industryBenchmarks: platformBenchmarks,
        comparison: {
          engagement: {
            value: platformMetrics.avgEngagement,
            benchmark: platformBenchmarks.engagement.p50,
            difference: platformMetrics.avgEngagement - platformBenchmarks.engagement.p50,
            percentage: platformBenchmarks.engagement.p50 > 0
              ? ((platformMetrics.avgEngagement / platformBenchmarks.engagement.p50) - 1) * 100
              : 0
          },
          engagementRate: {
            value: platformMetrics.avgEngagementRate,
            benchmark: platformBenchmarks.engagementRate.p50,
            difference: platformMetrics.avgEngagementRate - platformBenchmarks.engagementRate.p50,
            percentage: platformBenchmarks.engagementRate.p50 > 0
              ? ((platformMetrics.avgEngagementRate / platformBenchmarks.engagementRate.p50) - 1) * 100
              : 0
          }
        }
      };
    }

    // Overall benchmark score
    const overallScore = calculateOverallScore(benchmarks);

    return {
      contentId,
      contentTitle: content.title,
      hasData: true,
      metrics,
      benchmarks,
      overallScore,
      summary: generateBenchmarkSummary(benchmarks, overallScore)
    };
  } catch (error) {
    logger.error('Error benchmarking content performance', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Calculate aggregate metrics
 */
function calculateAggregateMetrics(posts, platformFilter = null) {
  const filteredPosts = platformFilter
    ? posts.filter(p => p.platform === platformFilter)
    : posts;

  if (filteredPosts.length === 0) {
    return {
      totalPosts: 0,
      totalEngagement: 0,
      totalImpressions: 0,
      avgEngagement: 0,
      avgImpressions: 0,
      avgEngagementRate: 0
    };
  }

  const totalEngagement = filteredPosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0);
  const totalImpressions = filteredPosts.reduce((sum, p) => sum + (p.analytics?.impressions || p.analytics?.views || 0), 0);
  const totalClicks = filteredPosts.reduce((sum, p) => sum + (p.analytics?.clicks || 0), 0);

  const avgEngagement = totalEngagement / filteredPosts.length;
  const avgImpressions = totalImpressions / filteredPosts.length;
  const avgEngagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;

  return {
    totalPosts: filteredPosts.length,
    totalEngagement,
    totalImpressions,
    totalClicks,
    avgEngagement: Math.round(avgEngagement),
    avgImpressions: Math.round(avgImpressions),
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100
  };
}

/**
 * Calculate platform-specific metrics
 */
function calculatePlatformMetrics(posts) {
  if (posts.length === 0) {
    return {
      count: 0,
      avgEngagement: 0,
      avgImpressions: 0,
      avgEngagementRate: 0
    };
  }

  const totalEngagement = posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0);
  const totalImpressions = posts.reduce((sum, p) => sum + (p.analytics?.impressions || p.analytics?.views || 0), 0);

  return {
    count: posts.length,
    avgEngagement: Math.round(totalEngagement / posts.length),
    avgImpressions: Math.round(totalImpressions / posts.length),
    avgEngagementRate: totalImpressions > 0
      ? Math.round((totalEngagement / totalImpressions) * 100 * 100) / 100
      : 0
  };
}

/**
 * Calculate overall benchmark score
 */
function calculateOverallScore(benchmarks) {
  if (!benchmarks || Object.keys(benchmarks).length === 0) {
    return { score: 0, grade: 'N/A' };
  }

  let totalPercentile = 0;
  let count = 0;

  Object.values(benchmarks).forEach(platformBenchmark => {
    if (platformBenchmark.percentiles) {
      totalPercentile += platformBenchmark.percentiles.engagement.percentile || 0;
      totalPercentile += platformBenchmark.percentiles.engagementRate.percentile || 0;
      count += 2;
    }
  });

  const avgPercentile = count > 0 ? totalPercentile / count : 0;
  const score = Math.round(avgPercentile);

  let grade;
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return { score, grade, percentile: avgPercentile };
}

/**
 * Generate benchmark summary
 */
function generateBenchmarkSummary(benchmarks, overallScore) {
  const insights = [];
  const recommendations = [];

  Object.entries(benchmarks).forEach(([platform, data]) => {
    const { percentiles, comparison } = data;

    // Engagement insights
    if (percentiles.engagement.percentile >= 75) {
      insights.push(`Excellent engagement on ${platform} (${percentiles.engagement.label})`);
    } else if (percentiles.engagement.percentile < 50) {
      insights.push(`Low engagement on ${platform} (${percentiles.engagement.label})`);
      recommendations.push(`Improve ${platform} engagement: Try different content formats or posting times`);
    }

    // Engagement rate insights
    if (percentiles.engagementRate.percentile >= 75) {
      insights.push(`Strong engagement rate on ${platform} (${percentiles.engagementRate.label})`);
    } else if (percentiles.engagementRate.percentile < 50) {
      recommendations.push(`Optimize ${platform} engagement rate: Review content quality and audience targeting`);
    }
  });

  // Overall grade insights
  if (overallScore.score >= 80) {
    insights.push(`Overall performance is excellent (Grade: ${overallScore.grade})`);
  } else if (overallScore.score < 60) {
    insights.push(`Overall performance needs improvement (Grade: ${overallScore.grade})`);
    recommendations.push('Focus on content quality and audience engagement strategies');
  }

  return {
    insights,
    recommendations,
    strengths: insights.filter(i => i.includes('Excellent') || i.includes('Strong')),
    weaknesses: insights.filter(i => i.includes('Low') || i.includes('needs improvement'))
  };
}

/**
 * Benchmark user's overall performance
 */
async function benchmarkUserPerformance(userId, period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get all user's posted content
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    if (posts.length === 0) {
      return {
        hasData: false,
        message: 'No posted content available for benchmarking'
      };
    }

    // Calculate user metrics by platform
    const userMetrics = {};
    const postsByPlatform = {};

    posts.forEach(post => {
      if (!postsByPlatform[post.platform]) {
        postsByPlatform[post.platform] = [];
      }
      postsByPlatform[post.platform].push(post);
    });

    // Calculate metrics and compare to benchmarks
    const platformBenchmarks = {};
    let totalScore = 0;
    let platformCount = 0;

    for (const [platform, platformPosts] of Object.entries(postsByPlatform)) {
      const benchmarks = INDUSTRY_BENCHMARKS[platform];
      if (!benchmarks) continue;

      const metrics = calculatePlatformMetrics(platformPosts);
      const engagementPercentile = calculatePercentile(metrics.avgEngagement, benchmarks.engagement);
      const engagementRatePercentile = calculatePercentile(metrics.avgEngagementRate, benchmarks.engagementRate);

      platformBenchmarks[platform] = {
        metrics,
        percentiles: {
          engagement: engagementPercentile,
          engagementRate: engagementRatePercentile
        },
        comparison: {
          engagement: {
            value: metrics.avgEngagement,
            benchmark: benchmarks.engagement.p50,
            difference: metrics.avgEngagement - benchmarks.engagement.p50,
            percentage: benchmarks.engagement.p50 > 0
              ? ((metrics.avgEngagement / benchmarks.engagement.p50) - 1) * 100
              : 0
          },
          engagementRate: {
            value: metrics.avgEngagementRate,
            benchmark: benchmarks.engagementRate.p50,
            difference: metrics.avgEngagementRate - benchmarks.engagementRate.p50,
            percentage: benchmarks.engagementRate.p50 > 0
              ? ((metrics.avgEngagementRate / benchmarks.engagementRate.p50) - 1) * 100
              : 0
          }
        }
      };

      totalScore += engagementPercentile.percentile;
      totalScore += engagementRatePercentile.percentile;
      platformCount += 2;
    }

    const overallScore = platformCount > 0
      ? Math.round(totalScore / platformCount)
      : 0;

    const grade = overallScore >= 90 ? 'A+' :
      overallScore >= 80 ? 'A' :
      overallScore >= 70 ? 'B' :
      overallScore >= 60 ? 'C' :
      overallScore >= 50 ? 'D' : 'F';

    return {
      hasData: true,
      period,
      totalPosts: posts.length,
      platformBenchmarks,
      overallScore: {
        score: overallScore,
        grade,
        percentile: overallScore
      },
      summary: generateUserBenchmarkSummary(platformBenchmarks, overallScore)
    };
  } catch (error) {
    logger.error('Error benchmarking user performance', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate user benchmark summary
 */
function generateUserBenchmarkSummary(platformBenchmarks, overallScore) {
  const insights = [];
  const recommendations = [];
  const strengths = [];
  const weaknesses = [];

  Object.entries(platformBenchmarks).forEach(([platform, data]) => {
    const { percentiles, comparison } = data;

    // Engagement analysis
    if (comparison.engagement.percentage > 20) {
      strengths.push(`${platform}: ${comparison.engagement.percentage.toFixed(1)}% above industry average`);
    } else if (comparison.engagement.percentage < -20) {
      weaknesses.push(`${platform}: ${Math.abs(comparison.engagement.percentage).toFixed(1)}% below industry average`);
      recommendations.push(`Improve ${platform} engagement: Focus on content quality and timing`);
    }

    // Engagement rate analysis
    if (comparison.engagementRate.percentage > 20) {
      strengths.push(`${platform}: Strong engagement rate (${comparison.engagementRate.percentage.toFixed(1)}% above average)`);
    } else if (comparison.engagementRate.percentage < -20) {
      weaknesses.push(`${platform}: Low engagement rate (${Math.abs(comparison.engagementRate.percentage).toFixed(1)}% below average)`);
      recommendations.push(`Optimize ${platform} targeting: Review audience and content strategy`);
    }
  });

  // Overall insights
  if (overallScore >= 80) {
    insights.push(`Excellent overall performance (${overallScore}th percentile)`);
  } else if (overallScore < 60) {
    insights.push(`Performance below industry average (${overallScore}th percentile)`);
    recommendations.push('Consider reviewing content strategy and engagement tactics');
  } else {
    insights.push(`Performance at industry average (${overallScore}th percentile)`);
  }

  return {
    insights,
    recommendations,
    strengths,
    weaknesses
  };
}

/**
 * Compare content to similar content
 */
async function compareToSimilarContent(userId, contentId) {
  try {
    const content = await Content.findOne({
      _id: contentId,
      userId
    }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    // Find similar content (same type, category, or tags)
    const similarQuery = {
      userId,
      _id: { $ne: contentId },
      status: 'posted'
    };

    const orConditions = [];
    if (content.type) {
      orConditions.push({ type: content.type });
    }
    if (content.category) {
      orConditions.push({ category: content.category });
    }
    if (content.tags && content.tags.length > 0) {
      orConditions.push({ tags: { $in: content.tags } });
    }

    if (orConditions.length > 0) {
      similarQuery.$or = orConditions;
    } else {
      return {
        hasComparison: false,
        message: 'No similar content found for comparison'
      };
    }

    const similarContent = await Content.find(similarQuery)
      .limit(10)
      .lean();

    if (similarContent.length === 0) {
      return {
        hasComparison: false,
        message: 'No similar content found for comparison'
      };
    }

    // Get posts for similar content
    const similarContentIds = similarContent.map(c => c._id);
    const similarPosts = await ScheduledPost.find({
      userId,
      contentId: { $in: similarContentIds },
      status: 'posted'
    }).lean();

    // Get posts for current content
    const currentPosts = await ScheduledPost.find({
      userId,
      contentId: content._id,
      status: 'posted'
    }).lean();

    // Calculate metrics
    const currentMetrics = calculateAggregateMetrics(currentPosts);
    const similarMetrics = calculateAggregateMetrics(similarPosts);

    // Calculate comparison
    const comparison = {
      engagement: {
        current: currentMetrics.avgEngagement,
        similar: similarMetrics.avgEngagement,
        difference: currentMetrics.avgEngagement - similarMetrics.avgEngagement,
        percentage: similarMetrics.avgEngagement > 0
          ? ((currentMetrics.avgEngagement / similarMetrics.avgEngagement) - 1) * 100
          : 0
      },
      engagementRate: {
        current: currentMetrics.avgEngagementRate,
        similar: similarMetrics.avgEngagementRate,
        difference: currentMetrics.avgEngagementRate - similarMetrics.avgEngagementRate,
        percentage: similarMetrics.avgEngagementRate > 0
          ? ((currentMetrics.avgEngagementRate / similarMetrics.avgEngagementRate) - 1) * 100
          : 0
      },
      impressions: {
        current: currentMetrics.avgImpressions,
        similar: similarMetrics.avgImpressions,
        difference: currentMetrics.avgImpressions - similarMetrics.avgImpressions,
        percentage: similarMetrics.avgImpressions > 0
          ? ((currentMetrics.avgImpressions / similarMetrics.avgImpressions) - 1) * 100
          : 0
      }
    };

    return {
      hasComparison: true,
      currentMetrics,
      similarMetrics,
      comparison,
      similarContentCount: similarContent.length,
      insights: generateComparisonInsights(comparison)
    };
  } catch (error) {
    logger.error('Error comparing to similar content', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Generate comparison insights
 */
function generateComparisonInsights(comparison) {
  const insights = [];

  if (comparison.engagement.percentage > 20) {
    insights.push(`Engagement is ${comparison.engagement.percentage.toFixed(1)}% higher than similar content`);
  } else if (comparison.engagement.percentage < -20) {
    insights.push(`Engagement is ${Math.abs(comparison.engagement.percentage).toFixed(1)}% lower than similar content`);
  }

  if (comparison.engagementRate.percentage > 20) {
    insights.push(`Engagement rate is ${comparison.engagementRate.percentage.toFixed(1)}% higher than similar content`);
  } else if (comparison.engagementRate.percentage < -20) {
    insights.push(`Engagement rate is ${Math.abs(comparison.engagementRate.percentage).toFixed(1)}% lower than similar content`);
  }

  return insights;
}

/**
 * Get performance trends over time
 */
async function getPerformanceTrends(userId, period = 90) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    })
      .sort({ postedAt: 1 })
      .lean();

    if (posts.length === 0) {
      return {
        hasData: false,
        message: 'No posted content available for trend analysis'
      };
    }

    // Group by week
    const weeklyData = {};
    posts.forEach(post => {
      const week = getWeekKey(post.postedAt);
      if (!weeklyData[week]) {
        weeklyData[week] = [];
      }
      weeklyData[week].push(post);
    });

    // Calculate weekly metrics
    const trends = Object.entries(weeklyData).map(([week, weekPosts]) => {
      const metrics = calculateAggregateMetrics(weekPosts);
      return {
        week,
        date: new Date(week.split('-')[0], week.split('-')[1] - 1, week.split('-')[2]),
        ...metrics
      };
    }).sort((a, b) => a.date - b.date);

    // Calculate trend direction
    const trendAnalysis = analyzeTrends(trends);

    return {
      hasData: true,
      period,
      trends,
      trendAnalysis,
      summary: generateTrendSummary(trendAnalysis)
    };
  } catch (error) {
    logger.error('Error getting performance trends', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get week key for grouping
 */
function getWeekKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = Math.ceil((d.getDate() + (d.getDay() === 0 ? 7 : d.getDay()) - 1) / 7);
  const month = d.getMonth() + 1;
  return `${year}-${month}-${week}`;
}

/**
 * Analyze trends
 */
function analyzeTrends(trends) {
  if (trends.length < 2) {
    return {
      engagement: { direction: 'stable', change: 0 },
      engagementRate: { direction: 'stable', change: 0 }
    };
  }

  const firstHalf = trends.slice(0, Math.floor(trends.length / 2));
  const secondHalf = trends.slice(Math.floor(trends.length / 2));

  const firstAvgEngagement = firstHalf.reduce((sum, t) => sum + t.avgEngagement, 0) / firstHalf.length;
  const secondAvgEngagement = secondHalf.reduce((sum, t) => sum + t.avgEngagement, 0) / secondHalf.length;
  const engagementChange = firstAvgEngagement > 0
    ? ((secondAvgEngagement / firstAvgEngagement) - 1) * 100
    : 0;

  const firstAvgRate = firstHalf.reduce((sum, t) => sum + t.avgEngagementRate, 0) / firstHalf.length;
  const secondAvgRate = secondHalf.reduce((sum, t) => sum + t.avgEngagementRate, 0) / secondHalf.length;
  const rateChange = firstAvgRate > 0
    ? ((secondAvgRate / firstAvgRate) - 1) * 100
    : 0;

  return {
    engagement: {
      direction: engagementChange > 5 ? 'improving' : engagementChange < -5 ? 'declining' : 'stable',
      change: Math.round(engagementChange * 10) / 10
    },
    engagementRate: {
      direction: rateChange > 5 ? 'improving' : rateChange < -5 ? 'declining' : 'stable',
      change: Math.round(rateChange * 10) / 10
    }
  };
}

/**
 * Generate trend summary
 */
function generateTrendSummary(trendAnalysis) {
  const insights = [];

  if (trendAnalysis.engagement.direction === 'improving') {
    insights.push(`Engagement is improving (+${trendAnalysis.engagement.change}%)`);
  } else if (trendAnalysis.engagement.direction === 'declining') {
    insights.push(`Engagement is declining (${trendAnalysis.engagement.change}%)`);
  }

  if (trendAnalysis.engagementRate.direction === 'improving') {
    insights.push(`Engagement rate is improving (+${trendAnalysis.engagementRate.change}%)`);
  } else if (trendAnalysis.engagementRate.direction === 'declining') {
    insights.push(`Engagement rate is declining (${trendAnalysis.engagementRate.change}%)`);
  }

  return insights;
}

/**
 * Predict future performance
 */
async function predictPerformance(userId, contentId) {
  try {
    const content = await Content.findOne({
      _id: contentId,
      userId
    }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    // Get historical performance
    const posts = await ScheduledPost.find({
      userId,
      contentId: content._id,
      status: 'posted'
    })
      .sort({ postedAt: 1 })
      .lean();

    if (posts.length < 2) {
      return {
        hasPrediction: false,
        message: 'Insufficient data for prediction'
      };
    }

    // Calculate trend
    const recentPosts = posts.slice(-5);
    const olderPosts = posts.slice(0, Math.max(1, posts.length - 5));

    const recentAvg = recentPosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / recentPosts.length;
    const olderAvg = olderPosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / olderPosts.length;

    const trend = olderAvg > 0 ? ((recentAvg / olderAvg) - 1) * 100 : 0;

    // Predict next performance
    const predictedEngagement = trend > 0
      ? recentAvg * (1 + (trend / 100))
      : recentAvg * (1 - (Math.abs(trend) / 100));

    // Compare to benchmarks
    const platform = posts[posts.length - 1].platform;
    const benchmarks = INDUSTRY_BENCHMARKS[platform];
    const predictedPercentile = benchmarks
      ? calculatePercentile(predictedEngagement, benchmarks.engagement)
      : { percentile: 0, label: 'N/A' };

    return {
      hasPrediction: true,
      currentAvg: Math.round(recentAvg),
      predictedEngagement: Math.round(predictedEngagement),
      trend: Math.round(trend * 10) / 10,
      predictedPercentile,
      confidence: posts.length >= 5 ? 'high' : posts.length >= 3 ? 'medium' : 'low',
      recommendation: trend > 0
        ? 'Performance is improving. Continue current strategy.'
        : 'Performance is declining. Consider content refresh or strategy change.'
    };
  } catch (error) {
    logger.error('Error predicting performance', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Save benchmark history
 */
async function saveBenchmarkHistory(userId, benchmarkData, period = 'weekly') {
  try {
    const BenchmarkHistory = require('../models/BenchmarkHistory');

    // Save for each platform
    for (const [platform, data] of Object.entries(benchmarkData.benchmarks || {})) {
      await BenchmarkHistory.create({
        userId,
        contentId: benchmarkData.contentId || null,
        platform,
        period,
        metrics: data.metrics,
        percentiles: {
          engagement: data.percentiles.engagement.percentile,
          engagementRate: data.percentiles.engagementRate.percentile,
          impressions: data.percentiles.impressions?.percentile || 0
        },
        overallScore: benchmarkData.overallScore,
        comparedToIndustry: data.comparison
      });
    }

    logger.info('Benchmark history saved', { userId, contentId: benchmarkData.contentId });
  } catch (error) {
    logger.error('Error saving benchmark history', { error: error.message, userId });
  }
}

/**
 * Get benchmark history
 */
async function getBenchmarkHistory(userId, options = {}) {
  try {
    const BenchmarkHistory = require('../models/BenchmarkHistory');
    const {
      contentId = null,
      platform = null,
      period = 'weekly',
      startDate = null,
      endDate = null
    } = options;

    const query = { userId };

    if (contentId) {
      query.contentId = contentId;
    }

    if (platform) {
      query.platform = platform;
    }

    if (period) {
      query.period = period;
    }

    if (startDate || endDate) {
      query.recordedAt = {};
      if (startDate) query.recordedAt.$gte = new Date(startDate);
      if (endDate) query.recordedAt.$lte = new Date(endDate);
    }

    const history = await BenchmarkHistory.find(query)
      .sort({ recordedAt: -1 })
      .lean();

    return history;
  } catch (error) {
    logger.error('Error getting benchmark history', { error: error.message, userId });
    throw error;
  }
}

/**
 * Compare performance across multiple periods
 */
async function comparePeriods(userId, periods = []) {
  try {
    const BenchmarkHistory = require('../models/BenchmarkHistory');

    const comparisons = [];

    for (const period of periods) {
      const { startDate, endDate, label } = period;
      const history = await BenchmarkHistory.find({
        userId,
        recordedAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }).lean();

      if (history.length === 0) continue;

      // Aggregate metrics
      const aggregated = aggregateHistoryMetrics(history);

      comparisons.push({
        label,
        period: { startDate, endDate },
        metrics: aggregated,
        recordCount: history.length
      });
    }

    // Calculate differences
    if (comparisons.length >= 2) {
      const latest = comparisons[0];
      const previous = comparisons[1];

      comparisons[0].change = {
        engagement: calculateChange(latest.metrics.avgEngagement, previous.metrics.avgEngagement),
        engagementRate: calculateChange(latest.metrics.avgEngagementRate, previous.metrics.avgEngagementRate),
        percentile: calculateChange(latest.metrics.avgPercentile, previous.metrics.avgPercentile)
      };
    }

    return { comparisons };
  } catch (error) {
    logger.error('Error comparing periods', { error: error.message, userId });
    throw error;
  }
}

/**
 * Aggregate history metrics
 */
function aggregateHistoryMetrics(history) {
  if (history.length === 0) {
    return {
      avgEngagement: 0,
      avgEngagementRate: 0,
      avgPercentile: 0
    };
  }

  const totalEngagement = history.reduce((sum, h) => sum + (h.metrics?.engagement || 0), 0);
  const totalEngagementRate = history.reduce((sum, h) => sum + (h.metrics?.engagementRate || 0), 0);
  const totalPercentile = history.reduce((sum, h) => sum + (h.percentiles?.engagement || 0), 0);

  return {
    avgEngagement: Math.round(totalEngagement / history.length),
    avgEngagementRate: Math.round((totalEngagementRate / history.length) * 100) / 100,
    avgPercentile: Math.round(totalPercentile / history.length)
  };
}

/**
 * Calculate change percentage
 */
function calculateChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current / previous) - 1) * 100 * 10) / 10;
}

/**
 * Check benchmark alerts
 */
async function checkBenchmarkAlerts(userId) {
  try {
    const BenchmarkAlert = require('../models/BenchmarkAlert');
    const CustomBenchmark = require('../models/CustomBenchmark');
    const notificationService = require('./notificationService');

    const alerts = await BenchmarkAlert.find({
      userId,
      isActive: true
    }).lean();

    if (alerts.length === 0) {
      return { checked: 0, triggered: 0 };
    }

    // Get current user performance
    const userBenchmark = await benchmarkUserPerformance(userId, 7); // Last 7 days

    if (!userBenchmark.hasData) {
      return { checked: alerts.length, triggered: 0 };
    }

    let triggeredCount = 0;

    for (const alert of alerts) {
      try {
        const platformData = userBenchmark.platformBenchmarks[alert.platform];
        if (!platformData) continue;

        let threshold = 0;
        let currentValue = 0;

        // Get threshold
        if (alert.useIndustryBenchmark) {
          const benchmarks = INDUSTRY_BENCHMARKS[alert.platform];
          if (!benchmarks) continue;

          if (alert.threshold === 'below_p25') {
            threshold = benchmarks[alert.metric]?.p25 || 0;
          } else if (alert.threshold === 'below_p50') {
            threshold = benchmarks[alert.metric]?.p50 || 0;
          } else if (alert.threshold === 'below_custom') {
            threshold = alert.customThreshold || 0;
          }
        } else if (alert.benchmarkId) {
          const customBenchmark = await CustomBenchmark.findById(alert.benchmarkId).lean();
          if (customBenchmark) {
            threshold = customBenchmark.metrics[alert.metric]?.min || 0;
          }
        }

        // Get current value
        if (alert.metric === 'engagement') {
          currentValue = platformData.metrics.avgEngagement;
        } else if (alert.metric === 'engagementRate') {
          currentValue = platformData.metrics.avgEngagementRate;
        } else if (alert.metric === 'impressions') {
          currentValue = platformData.metrics.avgImpressions;
        }

        // Check if alert should trigger
        if (currentValue < threshold) {
          // Send notification
          notificationService.notifyUser(userId, {
            type: 'warning',
            title: `Benchmark Alert: ${alert.name}`,
            message: `${alert.metric} on ${alert.platform} is below threshold (${currentValue.toFixed(1)} < ${threshold.toFixed(1)})`,
            data: {
              alertId: alert._id,
              platform: alert.platform,
              metric: alert.metric,
              currentValue,
              threshold
            }
          });

          // Update alert
          await BenchmarkAlert.findByIdAndUpdate(alert._id, {
            lastTriggered: new Date(),
            $inc: { triggerCount: 1 }
          });

          triggeredCount++;
        }
      } catch (error) {
        logger.error('Error checking alert', { error: error.message, alertId: alert._id });
      }
    }

    return { checked: alerts.length, triggered: triggeredCount };
  } catch (error) {
    logger.error('Error checking benchmark alerts', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  benchmarkContentPerformance,
  benchmarkUserPerformance,
  compareToSimilarContent,
  getPerformanceTrends,
  predictPerformance,
  saveBenchmarkHistory,
  getBenchmarkHistory,
  comparePeriods,
  checkBenchmarkAlerts,
  INDUSTRY_BENCHMARKS
};


// Competitive Benchmarking Service
// Benchmark vs competitors with actionable recommendations

const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Get competitive benchmarks
 */
async function getCompetitiveBenchmarks(userId, platform, timeframe = '30days') {
  try {
    // Get user's performance
    const userPosts = await getUserPerformance(userId, platform, timeframe);

    // Get industry benchmarks (would typically come from external data or config)
    const industryBenchmarks = getIndustryBenchmarks(platform);

    // Calculate user's percentile
    const percentile = calculatePercentile(userPosts.avgEngagement, industryBenchmarks.engagement);

    // Get competitor analysis (would typically come from competitor tracking)
    const competitorData = await getCompetitorData(userId, platform);

    const benchmark = {
      user: {
        avgEngagement: userPosts.avgEngagement,
        avgReach: userPosts.avgReach,
        postCount: userPosts.postCount,
        engagementRate: userPosts.engagementRate
      },
      industry: {
        median: industryBenchmarks.median,
        top25: industryBenchmarks.top25,
        top10: industryBenchmarks.top10,
        percentile: percentile
      },
      competitors: competitorData,
      gap: {
        toMedian: userPosts.avgEngagement - industryBenchmarks.median,
        toTop25: userPosts.avgEngagement - industryBenchmarks.top25,
        toTop10: userPosts.avgEngagement - industryBenchmarks.top10
      },
      recommendations: []
    };

    // Generate recommendations to beat benchmarks
    benchmark.recommendations = await generateBenchmarkRecommendations(benchmark);

    return benchmark;
  } catch (error) {
    logger.error('Error getting competitive benchmarks', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Get user performance
 */
async function getUserPerformance(userId, platform, timeframe) {
  const days = timeframe === '7days' ? 7 : timeframe === '30days' ? 30 : 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const posts = await ScheduledPost.find({
    userId,
    platform,
    status: 'posted',
    postedAt: { $gte: cutoffDate }
  }).lean();

  if (posts.length === 0) {
    return {
      avgEngagement: 0,
      avgReach: 0,
      postCount: 0,
      engagementRate: 0
    };
  }

  const totalEngagement = posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0);
  const totalReach = posts.reduce((sum, p) => sum + (p.analytics?.reach || p.analytics?.impressions || 0), 0);

  return {
    avgEngagement: Math.round(totalEngagement / posts.length),
    avgReach: Math.round(totalReach / posts.length),
    postCount: posts.length,
    engagementRate: totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0
  };
}

/**
 * Get industry benchmarks (mock data - would come from real industry data)
 */
function getIndustryBenchmarks(platform) {
  const benchmarks = {
    twitter: {
      median: 50,
      top25: 150,
      top10: 300
    },
    linkedin: {
      median: 100,
      top25: 300,
      top10: 600
    },
    facebook: {
      median: 80,
      top25: 250,
      top10: 500
    },
    instagram: {
      median: 200,
      top25: 600,
      top10: 1200
    },
    youtube: {
      median: 500,
      top25: 1500,
      top10: 3000
    },
    tiktok: {
      median: 300,
      top25: 1000,
      top10: 2500
    }
  };

  return benchmarks[platform] || benchmarks.twitter;
}

/**
 * Calculate percentile
 */
function calculatePercentile(value, benchmarks) {
  if (value >= benchmarks.top10) return 90;
  if (value >= benchmarks.top25) return 75;
  if (value >= benchmarks.median) return 50;
  if (value >= benchmarks.median * 0.5) return 25;
  return 10;
}

/**
 * Get competitor data (mock - would come from competitor tracking)
 */
async function getCompetitorData(userId, platform) {
  // In real implementation, this would fetch competitor data
  // For now, return mock data
  return {
    avgEngagement: 250,
    avgReach: 5000,
    postFrequency: 'daily',
    topPerformingTypes: ['video', 'article'],
    bestPostingTimes: ['09:00', '17:00']
  };
}

/**
 * Generate recommendations to beat benchmarks
 */
async function generateBenchmarkRecommendations(benchmark) {
  const recommendations = [];

  // Gap to median
  if (benchmark.gap.toMedian < 0) {
    const gap = Math.abs(benchmark.gap.toMedian);
    recommendations.push({
      type: 'beat_median',
      priority: 'high',
      title: `Beat industry median by ${Math.round(gap)} engagement`,
      description: `Your average engagement is ${benchmark.user.avgEngagement}. Industry median is ${benchmark.industry.median}.`,
      action: `Optimize content to increase engagement by ${Math.round(gap)} points`,
      estimatedImpact: `+${Math.round(gap)} engagement per post`,
      category: 'benchmark'
    });
  }

  // Gap to top 25%
  if (benchmark.gap.toTop25 < 0) {
    const gap = Math.abs(benchmark.gap.toTop25);
    recommendations.push({
      type: 'beat_top25',
      priority: 'high',
      title: `Reach top 25% (${Math.round(gap)} engagement gap)`,
      description: `Top 25% performers average ${benchmark.industry.top25} engagement. You're at ${benchmark.user.avgEngagement}.`,
      action: `Implement top performer strategies to close ${Math.round(gap)} point gap`,
      estimatedImpact: `Move to top 25% percentile`,
      category: 'benchmark'
    });
  }

  // Post frequency
  if (benchmark.user.postCount < 10) {
    recommendations.push({
      type: 'post_frequency',
      priority: 'medium',
      title: 'Increase posting frequency',
      description: `You've posted ${benchmark.user.postCount} times. Top performers post more frequently.`,
      action: 'Increase to 3-5 posts per week',
      estimatedImpact: '+20% overall engagement',
      category: 'benchmark'
    });
  }

  // Engagement rate
  if (benchmark.user.engagementRate < 2.0) {
    recommendations.push({
      type: 'engagement_rate',
      priority: 'high',
      title: 'Improve engagement rate',
      description: `Your engagement rate is ${benchmark.user.engagementRate.toFixed(2)}%. Industry average is 2-3%.`,
      action: 'Optimize content for higher engagement',
      estimatedImpact: '+50% engagement rate',
      category: 'benchmark'
    });
  }

  return recommendations;
}

/**
 * What to post next week to beat benchmark
 */
async function getNextWeekRecommendations(userId, platform) {
  try {
    const benchmark = await getCompetitiveBenchmarks(userId, platform, '30days');

    // Get content health and gaps
    const { performContentHealthCheck } = require('./contentHealthService');
    const healthCheck = await performContentHealthCheck(userId);

    // Get future content suggestions
    const { getFutureContentSuggestions } = require('./contentHealthService');
    const suggestions = await getFutureContentSuggestions(userId, healthCheck.gaps, 7);

    // Generate specific recommendations
    const recommendations = {
      goal: `Beat ${platform} benchmark (current: ${benchmark.user.avgEngagement}, target: ${benchmark.industry.top25})`,
      gap: Math.abs(benchmark.gap.toTop25),
      weeklyPlan: [],
      contentSuggestions: suggestions.slice(0, 7),
      postingSchedule: [],
      optimizationTips: []
    };

    // Create weekly plan
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    suggestions.slice(0, 7).forEach((suggestion, index) => {
      recommendations.weeklyPlan.push({
        day: days[index % 7],
        content: {
          title: suggestion.title,
          type: suggestion.type,
          category: suggestion.category,
          platforms: suggestion.platforms || [platform],
          estimatedEngagement: estimateEngagementFromSuggestion(suggestion, benchmark)
        },
        goal: `Target: ${Math.round(benchmark.industry.top25)} engagement`
      });
    });

    // Generate posting schedule
    recommendations.postingSchedule = generateOptimalSchedule(platform, recommendations.weeklyPlan);

    // Optimization tips
    recommendations.optimizationTips = [
      `Post at optimal times: ${benchmark.competitors.bestPostingTimes.join(', ')}`,
      `Focus on ${benchmark.competitors.topPerformingTypes.join(' and ')} content`,
      `Aim for ${Math.round(benchmark.industry.top25)}+ engagement per post`,
      `Post ${recommendations.weeklyPlan.length} times this week`
    ];

    return recommendations;
  } catch (error) {
    logger.error('Error getting next week recommendations', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Estimate engagement from suggestion
 */
function estimateEngagementFromSuggestion(suggestion, benchmark) {
  const baseEngagement = benchmark.user.avgEngagement;
  const potential = suggestion.engagementPotential || 'medium';

  const multipliers = {
    high: 1.5,
    medium: 1.2,
    low: 0.9
  };

  return Math.round(baseEngagement * multipliers[potential]);
}

/**
 * Generate optimal schedule
 */
function generateOptimalSchedule(platform, weeklyPlan) {
  const optimalTimes = {
    twitter: ['09:00', '12:00', '17:00'],
    linkedin: ['08:00', '12:00', '17:00'],
    facebook: ['09:00', '13:00', '18:00'],
    instagram: ['11:00', '14:00', '17:00'],
    youtube: ['15:00', '19:00'],
    tiktok: ['18:00', '21:00']
  };

  const times = optimalTimes[platform] || ['09:00', '17:00'];
  const schedule = [];

  weeklyPlan.forEach((plan, index) => {
    schedule.push({
      day: plan.day,
      time: times[index % times.length],
      content: plan.content.title,
      platform: plan.content.platforms[0] || platform
    });
  });

  return schedule;
}

/**
 * Advanced competitor tracking
 */
async function trackCompetitors(userId, competitorUsernames, platform) {
  try {
    const competitors = [];

    for (const username of competitorUsernames) {
      try {
        // In real implementation, this would fetch from platform APIs
        // For now, return structured data format
        const competitor = {
          username,
          platform,
          metrics: {
            avgEngagement: 0,
            avgReach: 0,
            postFrequency: 'unknown',
            bestPerformingTypes: [],
            topHashtags: [],
            postingTimes: []
          },
          recentPosts: [],
          insights: []
        };

        // Mock data structure - would be populated from actual API calls
        competitors.push(competitor);
      } catch (error) {
        logger.warn('Error tracking competitor', { error: error.message, username, platform });
      }
    }

    return {
      competitors,
      trackedAt: new Date(),
      platform
    };
  } catch (error) {
    logger.error('Error tracking competitors', { error: error.message, userId });
    throw error;
  }
}

/**
 * Compare with competitors
 */
async function compareWithCompetitors(userId, platform) {
  try {
    const userBenchmark = await getCompetitiveBenchmarks(userId, platform);
    const competitorData = userBenchmark.competitors;

    const comparison = {
      user: {
        avgEngagement: userBenchmark.user.avgEngagement,
        percentile: userBenchmark.industry.percentile
      },
      vsCompetitors: {
        betterThan: 0,
        worseThan: 0,
        similarTo: 0
      },
      gaps: [],
      opportunities: []
    };

    // Compare with competitor average
    if (competitorData.avgEngagement > 0) {
      const gap = userBenchmark.user.avgEngagement - competitorData.avgEngagement;
      
      if (gap > 0) {
        comparison.vsCompetitors.betterThan = 1;
        comparison.opportunities.push({
          type: 'maintain_advantage',
          message: `You're performing ${Math.round(gap)} engagement points better than competitors`,
          action: 'Maintain current strategy'
        });
      } else if (gap < 0) {
        comparison.vsCompetitors.worseThan = 1;
        comparison.gaps.push({
          type: 'engagement_gap',
          gap: Math.abs(gap),
          message: `Competitors average ${Math.abs(gap)} more engagement`,
          action: `Optimize content to close ${Math.abs(gap)} point gap`
        });
      } else {
        comparison.vsCompetitors.similarTo = 1;
      }
    }

    // Analyze competitor strategies
    if (competitorData.topPerformingTypes && competitorData.topPerformingTypes.length > 0) {
      comparison.opportunities.push({
        type: 'content_type',
        message: `Competitors perform well with: ${competitorData.topPerformingTypes.join(', ')}`,
        action: `Consider creating more ${competitorData.topPerformingTypes[0]} content`
      });
    }

    if (competitorData.bestPostingTimes && competitorData.bestPostingTimes.length > 0) {
      comparison.opportunities.push({
        type: 'posting_time',
        message: `Competitors post at: ${competitorData.bestPostingTimes.join(', ')}`,
        action: `Schedule posts at ${competitorData.bestPostingTimes[0]}`
      });
    }

    return comparison;
  } catch (error) {
    logger.error('Error comparing with competitors', { error: error.message, userId, platform });
    throw error;
  }
}

module.exports = {
  getCompetitiveBenchmarks,
  getNextWeekRecommendations,
  trackCompetitors,
  compareWithCompetitors
};


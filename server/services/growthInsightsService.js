// Growth Insights Service
// Provides engagement and growth insights, recommendations, and forecasting

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const logger = require('../utils/logger');
const { generateAIInsight } = require('./aiService');

/**
 * Get growth metrics for a user
 */
async function getGrowthMetrics(userId, period = 30) {
  try {
    const now = new Date();
    const currentPeriodStart = new Date(now);
    currentPeriodStart.setDate(currentPeriodStart.getDate() - period);
    
    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - period);
    const previousPeriodEnd = new Date(currentPeriodStart);

    // Get posts from current period
    const currentPosts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: currentPeriodStart }
    }).lean();

    // Get posts from previous period
    const previousPosts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: {
        $gte: previousPeriodStart,
        $lt: previousPeriodEnd
      }
    }).lean();

    // Calculate engagement metrics
    const currentEngagement = currentPosts.reduce((sum, post) => 
      sum + (post.analytics?.engagement || 0), 0
    );
    const previousEngagement = previousPosts.reduce((sum, post) => 
      sum + (post.analytics?.engagement || 0), 0
    );

    // Calculate reach metrics
    const currentReach = currentPosts.reduce((sum, post) => 
      sum + (post.analytics?.impressions || post.analytics?.views || 0), 0
    );
    const previousReach = previousPosts.reduce((sum, post) => 
      sum + (post.analytics?.impressions || post.analytics?.views || 0), 0
    );

    // Calculate engagement rate
    const currentEngagementRate = currentReach > 0 
      ? (currentEngagement / currentReach) * 100 
      : 0;
    const previousEngagementRate = previousReach > 0 
      ? (previousEngagement / previousReach) * 100 
      : 0;

    // Get follower data (if available from platform analytics)
    const platformAnalytics = await getPlatformFollowerData(userId, period);

    const metrics = {
      engagement: {
        current: currentEngagement,
        previous: previousEngagement,
        change: previousEngagement > 0 
          ? ((currentEngagement - previousEngagement) / previousEngagement) * 100 
          : 0,
        trend: currentEngagement >= previousEngagement ? 'up' : 'down'
      },
      followers: {
        current: platformAnalytics.totalFollowers || 0,
        previous: platformAnalytics.previousFollowers || 0,
        change: platformAnalytics.followerChange || 0,
        trend: (platformAnalytics.followerChange || 0) >= 0 ? 'up' : 'down'
      },
      reach: {
        current: currentReach,
        previous: previousReach,
        change: previousReach > 0 
          ? ((currentReach - previousReach) / previousReach) * 100 
          : 0,
        trend: currentReach >= previousReach ? 'up' : 'down'
      },
      engagementRate: {
        current: currentEngagementRate,
        previous: previousEngagementRate,
        change: previousEngagementRate > 0 
          ? ((currentEngagementRate - previousEngagementRate) / previousEngagementRate) * 100 
          : 0,
        trend: currentEngagementRate >= previousEngagementRate ? 'up' : 'down'
      }
    };

    return metrics;
  } catch (error) {
    logger.error('Error getting growth metrics', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get platform follower data
 */
async function getPlatformFollowerData(userId, period) {
  try {
    // This would integrate with platform analytics APIs
    // For now, return placeholder data
    // In production, this would fetch from platformAnalyticsService
    
    return {
      totalFollowers: 0,
      previousFollowers: 0,
      followerChange: 0
    };
  } catch (error) {
    logger.error('Error getting platform follower data', { error: error.message });
    return {
      totalFollowers: 0,
      previousFollowers: 0,
      followerChange: 0
    };
  }
}

/**
 * Get growth insights and recommendations
 */
async function getGrowthInsights(userId, period = 30) {
  try {
    const metrics = await getGrowthMetrics(userId, period);
    const insights = [];

    // Engagement insights
    if (metrics.engagement.change < -10) {
      insights.push({
        type: 'warning',
        title: 'Engagement Decline Detected',
        description: `Your engagement has decreased by ${Math.abs(metrics.engagement.change).toFixed(1)}% compared to the previous period. Consider posting at optimal times and using high-performing hashtags.`,
        action: 'View Optimal Posting Times',
        impact: 'high'
      });
    } else if (metrics.engagement.change > 20) {
      insights.push({
        type: 'success',
        title: 'Strong Engagement Growth!',
        description: `Your engagement has increased by ${metrics.engagement.change.toFixed(1)}%! Keep creating similar content to maintain this momentum.`,
        action: 'View Top Performing Content',
        impact: 'medium'
      });
    }

    // Engagement rate insights
    if (metrics.engagementRate.current < 2) {
      insights.push({
        type: 'opportunity',
        title: 'Low Engagement Rate',
        description: `Your engagement rate is ${metrics.engagementRate.current.toFixed(2)}%. Industry average is 3-5%. Try using more engaging visuals, asking questions, or posting at optimal times.`,
        action: 'Get Engagement Tips',
        impact: 'high'
      });
    }

    // Platform performance insights
    const platformInsights = await getPlatformPerformanceInsights(userId, period);
    insights.push(...platformInsights);

    // Content type insights
    const contentTypeInsights = await getContentTypeInsights(userId, period);
    insights.push(...contentTypeInsights);

    // Posting frequency insights
    const frequencyInsights = await getPostingFrequencyInsights(userId, period);
    insights.push(...frequencyInsights);

    // AI-generated insights
    const aiInsights = await generateAIInsights(userId, metrics, period);
    insights.push(...aiInsights);

    return insights;
  } catch (error) {
    logger.error('Error getting growth insights', { error: error.message, userId });
    return [];
  }
}

/**
 * Get platform performance insights
 */
async function getPlatformPerformanceInsights(userId, period) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    // Group by platform
    const platformStats = {};
    posts.forEach(post => {
      if (!platformStats[post.platform]) {
        platformStats[post.platform] = {
          posts: 0,
          engagement: 0,
          reach: 0
        };
      }
      platformStats[post.platform].posts++;
      platformStats[post.platform].engagement += post.analytics?.engagement || 0;
      platformStats[post.platform].reach += post.analytics?.impressions || post.analytics?.views || 0;
    });

    // Calculate engagement rates per platform
    const platformRates = {};
    Object.keys(platformStats).forEach(platform => {
      const stats = platformStats[platform];
      platformRates[platform] = stats.reach > 0 
        ? (stats.engagement / stats.reach) * 100 
        : 0;
    });

    const insights = [];

    // Find best performing platform
    const bestPlatform = Object.keys(platformRates).reduce((a, b) => 
      platformRates[a] > platformRates[b] ? a : b, Object.keys(platformRates)[0]
    );

    if (bestPlatform) {
      insights.push({
        type: 'opportunity',
        title: `${bestPlatform.charAt(0).toUpperCase() + bestPlatform.slice(1)} is Your Top Platform`,
        description: `Your ${bestPlatform} posts have the highest engagement rate (${platformRates[bestPlatform].toFixed(2)}%). Consider increasing content for this platform.`,
        action: 'Schedule More Posts',
        impact: 'medium'
      });
    }

    // Check for underperforming platforms
    Object.keys(platformRates).forEach(platform => {
      if (platformRates[platform] < 1 && platformStats[platform].posts > 5) {
        insights.push({
          type: 'warning',
          title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Needs Optimization`,
          description: `Your ${platform} posts have low engagement (${platformRates[platform].toFixed(2)}%). Try different content formats or posting times.`,
          action: 'Optimize Content',
          impact: 'medium'
        });
      }
    });

    return insights;
  } catch (error) {
    logger.error('Error getting platform performance insights', { error: error.message });
    return [];
  }
}

/**
 * Get content type insights
 */
async function getContentTypeInsights(userId, period) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);

    const contents = await Content.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).populate('content.contentId').lean();

    // Group by content type
    const typeStats = {};
    posts.forEach(post => {
      const contentType = post.content?.contentId?.type || 'unknown';
      if (!typeStats[contentType]) {
        typeStats[contentType] = {
          posts: 0,
          engagement: 0
        };
      }
      typeStats[contentType].posts++;
      typeStats[contentType].engagement += post.analytics?.engagement || 0;
    });

    // Find best performing type
    const bestType = Object.keys(typeStats).reduce((a, b) => 
      (typeStats[a].engagement / typeStats[a].posts) > (typeStats[b].engagement / typeStats[b].posts) 
        ? a : b, 
      Object.keys(typeStats)[0]
    );

    const insights = [];

    if (bestType && typeStats[bestType].posts > 3) {
      const avgEngagement = typeStats[bestType].engagement / typeStats[bestType].posts;
      insights.push({
        type: 'opportunity',
        title: `${bestType.charAt(0).toUpperCase() + bestType.slice(1)} Content Performs Best`,
        description: `Your ${bestType} content averages ${Math.round(avgEngagement)} engagement per post. Create more ${bestType} content to maximize growth.`,
        action: 'Create More Content',
        impact: 'high'
      });
    }

    return insights;
  } catch (error) {
    logger.error('Error getting content type insights', { error: error.message });
    return [];
  }
}

/**
 * Get posting frequency insights
 */
async function getPostingFrequencyInsights(userId, period) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    const postsPerDay = posts.length / period;
    const insights = [];

    if (postsPerDay < 0.5) {
      insights.push({
        type: 'opportunity',
        title: 'Increase Posting Frequency',
        description: `You're posting ${postsPerDay.toFixed(1)} times per day. Increasing to 1-2 posts per day can significantly boost engagement and growth.`,
        action: 'Schedule More Posts',
        impact: 'high'
      });
    } else if (postsPerDay > 3) {
      insights.push({
        type: 'warning',
        title: 'High Posting Frequency',
        description: `You're posting ${postsPerDay.toFixed(1)} times per day. Consider focusing on quality over quantity to maintain engagement rates.`,
        action: 'Review Content Quality',
        impact: 'medium'
      });
    }

    return insights;
  } catch (error) {
    logger.error('Error getting posting frequency insights', { error: error.message });
    return [];
  }
}

/**
 * Generate AI-powered insights
 */
async function generateAIInsights(userId, metrics, period) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).limit(50).lean();

    const contents = await Content.find({
      userId,
      createdAt: { $gte: startDate }
    }).limit(20).lean();

    // Prepare data for AI analysis
    const analysisData = {
      metrics,
      postCount: posts.length,
      contentCount: contents.length,
      topPerforming: posts
        .filter(p => p.analytics?.engagement)
        .sort((a, b) => (b.analytics?.engagement || 0) - (a.analytics?.engagement || 0))
        .slice(0, 5)
        .map(p => ({
          platform: p.platform,
          engagement: p.analytics?.engagement || 0,
          postedAt: p.postedAt
        }))
    };

    // Generate AI insight
    const aiInsight = await generateAIInsight(analysisData);
    
    if (aiInsight) {
      return [{
        type: 'opportunity',
        title: aiInsight.title || 'AI Growth Recommendation',
        description: aiInsight.description || aiInsight.recommendation,
        action: aiInsight.action,
        impact: aiInsight.impact || 'medium'
      }];
    }

    return [];
  } catch (error) {
    logger.error('Error generating AI insights', { error: error.message });
    return [];
  }
}

/**
 * Get content performance forecast
 */
async function getContentForecast(userId, days = 30) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 90); // Use 90 days of history

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).sort({ postedAt: 1 }).lean();

    if (posts.length < 10) {
      return {
        forecast: null,
        confidence: 'low',
        message: 'Not enough data for accurate forecasting'
      };
    }

    // Calculate daily averages
    const dailyStats = {};
    posts.forEach(post => {
      const date = post.postedAt.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { posts: 0, engagement: 0 };
      }
      dailyStats[date].posts++;
      dailyStats[date].engagement += post.analytics?.engagement || 0;
    });

    // Calculate trend
    const dates = Object.keys(dailyStats).sort();
    const recentEngagement = dates.slice(-7).reduce((sum, date) => 
      sum + dailyStats[date].engagement, 0
    ) / 7;
    const earlierEngagement = dates.slice(-14, -7).reduce((sum, date) => 
      sum + dailyStats[date].engagement, 0
    ) / 7;

    const trend = recentEngagement > earlierEngagement ? 'up' : 'down';
    const growthRate = earlierEngagement > 0 
      ? ((recentEngagement - earlierEngagement) / earlierEngagement) * 100 
      : 0;

    // Forecast
    const currentAvg = recentEngagement;
    const projectedEngagement = currentAvg * days * (1 + (growthRate / 100));

    return {
      forecast: {
        projectedEngagement: Math.round(projectedEngagement),
        projectedReach: Math.round(projectedEngagement * 10), // Estimate
        growthRate: growthRate,
        trend: trend
      },
      confidence: posts.length > 30 ? 'high' : 'medium',
      message: trend === 'up' 
        ? `Based on current trends, you're on track for ${Math.round(projectedEngagement)} engagement in the next ${days} days.`
        : `Your engagement trend is declining. Consider optimizing your content strategy.`
    };
  } catch (error) {
    logger.error('Error getting content forecast', { error: error.message, userId });
    return {
      forecast: null,
      confidence: 'low',
      message: 'Unable to generate forecast'
    };
  }
}

/**
 * Get engagement optimization recommendations
 */
async function getEngagementRecommendations(userId) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    const recommendations = [];

    // Analyze posting times
    const hourStats = {};
    posts.forEach(post => {
      const hour = new Date(post.postedAt).getHours();
      if (!hourStats[hour]) {
        hourStats[hour] = { posts: 0, engagement: 0 };
      }
      hourStats[hour].posts++;
      hourStats[hour].engagement += post.analytics?.engagement || 0;
    });

    // Find best posting hour
    const bestHour = Object.keys(hourStats).reduce((a, b) => 
      (hourStats[a].engagement / hourStats[a].posts) > (hourStats[b].engagement / hourStats[b].posts) 
        ? a : b,
      Object.keys(hourStats)[0]
    );

    if (bestHour) {
      recommendations.push({
        type: 'posting_time',
        title: `Post at ${bestHour}:00 for Best Engagement`,
        description: `Your posts at ${bestHour}:00 average ${Math.round(hourStats[bestHour].engagement / hourStats[bestHour].posts)} engagement. Schedule more content for this time.`,
        priority: 'high'
      });
    }

    // Analyze hashtag usage
    const hashtagStats = {};
    posts.forEach(post => {
      if (post.content?.hashtags) {
        post.content.hashtags.forEach(tag => {
          if (!hashtagStats[tag]) {
            hashtagStats[tag] = { posts: 0, engagement: 0 };
          }
          hashtagStats[tag].posts++;
          hashtagStats[tag].engagement += post.analytics?.engagement || 0;
        });
      }
    });

    // Find best hashtags
    const bestHashtags = Object.keys(hashtagStats)
      .map(tag => ({
        tag,
        avgEngagement: hashtagStats[tag].engagement / hashtagStats[tag].posts
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 5);

    if (bestHashtags.length > 0) {
      recommendations.push({
        type: 'hashtags',
        title: 'Use These High-Performing Hashtags',
        description: `These hashtags drive the most engagement: ${bestHashtags.map(h => h.tag).join(', ')}`,
        priority: 'medium',
        hashtags: bestHashtags.map(h => h.tag)
      });
    }

    return recommendations;
  } catch (error) {
    logger.error('Error getting engagement recommendations', { error: error.message, userId });
    return [];
  }
}

module.exports = {
  getGrowthMetrics,
  getGrowthInsights,
  getContentForecast,
  getEngagementRecommendations,
};



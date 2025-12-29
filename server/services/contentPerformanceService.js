// Content performance analytics service

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Get performance analytics for a specific content item
 */
async function getContentPerformance(contentId, userId) {
  try {
    const content = await Content.findOne({
      _id: contentId,
      userId
    });

    if (!content) {
      throw new Error('Content not found');
    }

    // Get related posts
    const posts = await ScheduledPost.find({
      userId,
      'content.contentId': contentId
    });

    const performance = {
      contentId: content._id,
      title: content.title,
      type: content.type,
      createdAt: content.createdAt,
      metrics: {
        totalPosts: posts.length,
        posted: posts.filter(p => p.status === 'posted').length,
        scheduled: posts.filter(p => p.status === 'scheduled').length,
        failed: posts.filter(p => p.status === 'failed').length,
        totalEngagement: 0,
        totalViews: 0,
        totalClicks: 0,
        averageEngagement: 0,
        averageViews: 0,
        averageClicks: 0
      },
      platformBreakdown: {},
      timeSeries: [],
      bestPerforming: [],
      recommendations: []
    };

    // Calculate engagement metrics
    let totalEngagement = 0;
    let totalViews = 0;
    let totalClicks = 0;
    let engagementCount = 0;
    let viewsCount = 0;
    let clicksCount = 0;

    posts.forEach(post => {
      if (post.analytics) {
        if (post.analytics.engagement) {
          totalEngagement += post.analytics.engagement;
          engagementCount++;
        }
        if (post.analytics.views || post.analytics.impressions) {
          totalViews += (post.analytics.views || post.analytics.impressions);
          viewsCount++;
        }
        if (post.analytics.clicks) {
          totalClicks += post.analytics.clicks;
          clicksCount++;
        }

        // Platform breakdown
        if (!performance.platformBreakdown[post.platform]) {
          performance.platformBreakdown[post.platform] = {
            posts: 0,
            engagement: 0,
            views: 0,
            clicks: 0
          };
        }
        performance.platformBreakdown[post.platform].posts++;
        if (post.analytics.engagement) {
          performance.platformBreakdown[post.platform].engagement += post.analytics.engagement;
        }
        if (post.analytics.views || post.analytics.impressions) {
          performance.platformBreakdown[post.platform].views += (post.analytics.views || post.analytics.impressions);
        }
        if (post.analytics.clicks) {
          performance.platformBreakdown[post.platform].clicks += post.analytics.clicks;
        }
      }
    });

    performance.metrics.totalEngagement = totalEngagement;
    performance.metrics.totalViews = totalViews;
    performance.metrics.totalClicks = totalClicks;
    performance.metrics.averageEngagement = engagementCount > 0 ? totalEngagement / engagementCount : 0;
    performance.metrics.averageViews = viewsCount > 0 ? totalViews / viewsCount : 0;
    performance.metrics.averageClicks = clicksCount > 0 ? totalClicks / clicksCount : 0;

    // Time series data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = posts.filter(p => 
      p.createdAt >= thirtyDaysAgo && p.analytics
    );

    const dailyData = {};
    recentPosts.forEach(post => {
      const date = post.createdAt.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          posts: 0,
          engagement: 0,
          views: 0,
          clicks: 0
        };
      }
      dailyData[date].posts++;
      if (post.analytics.engagement) dailyData[date].engagement += post.analytics.engagement;
      if (post.analytics.views || post.analytics.impressions) {
        dailyData[date].views += (post.analytics.views || post.analytics.impressions);
      }
      if (post.analytics.clicks) dailyData[date].clicks += post.analytics.clicks;
    });

    performance.timeSeries = Object.values(dailyData).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Best performing posts
    const postsWithEngagement = posts
      .filter(p => p.analytics && p.analytics.engagement)
      .sort((a, b) => (b.analytics.engagement || 0) - (a.analytics.engagement || 0))
      .slice(0, 5);

    performance.bestPerforming = postsWithEngagement.map(post => ({
      postId: post._id,
      platform: post.platform,
      scheduledTime: post.scheduledTime,
      engagement: post.analytics.engagement,
      views: post.analytics.views || post.analytics.impressions,
      clicks: post.analytics.clicks
    }));

    // Generate recommendations
    performance.recommendations = generateRecommendations(performance);

    return performance;
  } catch (error) {
    logger.error('Error getting content performance', { error: error.message, contentId, userId });
    throw error;
  }
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(performance) {
  const recommendations = [];

  if (performance.metrics.totalPosts === 0) {
    recommendations.push({
      type: 'info',
      priority: 'high',
      message: 'This content hasn\'t been posted yet. Consider scheduling posts to see performance metrics.',
      action: 'schedule'
    });
  }

  if (performance.metrics.averageEngagement < 10 && performance.metrics.totalPosts > 0) {
    recommendations.push({
      type: 'warning',
      priority: 'medium',
      message: 'Low engagement detected. Try posting at different times or on different platforms.',
      action: 'optimize'
    });
  }

  const platforms = Object.keys(performance.platformBreakdown);
  if (platforms.length === 1) {
    recommendations.push({
      type: 'suggestion',
      priority: 'low',
      message: `Only posted on ${platforms[0]}. Consider cross-posting to other platforms for better reach.`,
      action: 'diversify'
    });
  }

  const bestPlatform = Object.entries(performance.platformBreakdown)
    .sort((a, b) => (b[1].engagement / b[1].posts) - (a[1].engagement / a[1].posts))[0];

  if (bestPlatform) {
    recommendations.push({
      type: 'success',
      priority: 'low',
      message: `${bestPlatform[0]} is performing best with ${(bestPlatform[1].engagement / bestPlatform[1].posts).toFixed(1)} avg engagement. Focus more on this platform.`,
      action: 'focus'
    });
  }

  return recommendations;
}

/**
 * Get performance predictions for content
 */
async function getPerformancePrediction(contentId, userId) {
  try {
    const content = await Content.findOne({
      _id: contentId,
      userId
    });

    if (!content) {
      throw new Error('Content not found');
    }

    // Get historical performance of similar content
    const similarContent = await Content.find({
      userId,
      type: content.type,
      category: content.category,
      _id: { $ne: contentId }
    }).limit(10);

    const posts = await ScheduledPost.find({
      userId,
      'content.contentId': { $in: similarContent.map(c => c._id) }
    });

    // Calculate average performance
    let totalEngagement = 0;
    let count = 0;

    posts.forEach(post => {
      if (post.analytics && post.analytics.engagement) {
        totalEngagement += post.analytics.engagement;
        count++;
      }
    });

    const averageEngagement = count > 0 ? totalEngagement / count : 0;

    // Simple prediction based on content characteristics
    let predictedEngagement = averageEngagement;

    // Adjust based on content type
    const typeMultipliers = {
      video: 1.2,
      article: 1.0,
      podcast: 0.9,
      transcript: 0.8
    };

    predictedEngagement *= (typeMultipliers[content.type] || 1.0);

    // Adjust based on tags (more tags = potentially more reach)
    if (content.tags && content.tags.length > 0) {
      predictedEngagement *= (1 + content.tags.length * 0.05);
    }

    return {
      contentId: content._id,
      predictedEngagement: Math.round(predictedEngagement),
      confidence: count > 5 ? 'high' : count > 2 ? 'medium' : 'low',
      basedOn: count,
      factors: {
        type: content.type,
        category: content.category,
        tags: content.tags?.length || 0,
        similarContentCount: similarContent.length
      }
    };
  } catch (error) {
    logger.error('Error getting performance prediction', { error: error.message, contentId, userId });
    throw error;
  }
}

/**
 * Get optimal posting times
 */
async function getOptimalPostingTimes(userId, platform) {
  try {
    const posts = await ScheduledPost.find({
      userId,
      platform: platform || { $exists: true },
      status: 'posted',
      analytics: { $exists: true }
    });

    if (posts.length === 0) {
      return {
        platform: platform || 'all',
        recommendations: [],
        message: 'Not enough data to determine optimal posting times'
      };
    }

    // Group by hour of day
    const hourlyData = {};
    posts.forEach(post => {
      const hour = new Date(post.scheduledTime).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          hour,
          posts: 0,
          totalEngagement: 0,
          count: 0
        };
      }
      hourlyData[hour].posts++;
      if (post.analytics && post.analytics.engagement) {
        hourlyData[hour].totalEngagement += post.analytics.engagement;
        hourlyData[hour].count++;
      }
    });

    // Calculate average engagement per hour
    const hourlyAverages = Object.values(hourlyData).map(data => ({
      hour: data.hour,
      averageEngagement: data.count > 0 ? data.totalEngagement / data.count : 0,
      posts: data.posts
    }));

    // Sort by average engagement
    hourlyAverages.sort((a, b) => b.averageEngagement - a.averageEngagement);

    // Get top 3 hours
    const topHours = hourlyAverages.slice(0, 3);

    return {
      platform: platform || 'all',
      optimalHours: topHours.map(h => ({
        hour: h.hour,
        time: `${h.hour}:00`,
        averageEngagement: h.averageEngagement,
        posts: h.posts
      })),
      allHours: hourlyAverages
    };
  } catch (error) {
    logger.error('Error getting optimal posting times', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getContentPerformance,
  getPerformancePrediction,
  getOptimalPostingTimes
};








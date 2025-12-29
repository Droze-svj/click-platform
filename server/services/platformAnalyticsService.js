// Platform analytics service - sync real-time data from social platforms

const SocialConnection = require('../models/SocialConnection');
const ScheduledPost = require('../models/ScheduledPost');
const { getValidAccessToken } = require('./tokenRefreshService');
const axios = require('axios');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Sync analytics from Twitter/X
 */
async function syncTwitterAnalytics(userId, postId, platformPostId) {
  try {
    const accessToken = await getValidAccessToken(userId, 'twitter');
    
    // Twitter API v2 - Get tweet metrics
    const response = await axios.get(`https://api.twitter.com/2/tweets/${platformPostId}`, {
      params: {
        'tweet.fields': 'public_metrics,created_at',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const metrics = response.data.data?.public_metrics || {};
    
    const impressions = metrics.impression_count || 0;
    const likes = metrics.like_count || 0;
    const retweets = metrics.retweet_count || 0;
    const replies = metrics.reply_count || 0;
    const engagement = likes + retweets + replies;

    return {
      views: impressions,
      likes,
      retweets,
      replies,
      engagement,
      clicks: 0, // Twitter doesn't provide click data in basic API
      impressions,
      reach: impressions, // Twitter doesn't distinguish reach from impressions in basic API
      uniqueReach: impressions,
      engagementBreakdown: {
        likes,
        comments: replies,
        shares: retweets,
        retweets,
        saves: 0,
        clicks: 0,
        reactions: 0
      },
      syncedAt: new Date(),
    };
  } catch (error) {
    logger.error('Twitter analytics sync error', { error: error.message, userId, postId });
    captureException(error, { tags: { platform: 'twitter', operation: 'analytics_sync' } });
    throw error;
  }
}

/**
 * Sync analytics from LinkedIn
 */
async function syncLinkedInAnalytics(userId, postId, platformPostId) {
  try {
    const accessToken = await getValidAccessToken(userId, 'linkedin');
    
    // LinkedIn API - Get post analytics
    // Note: LinkedIn analytics requires specific permissions
    const response = await axios.get(`https://api.linkedin.com/v2/socialActions/${platformPostId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // LinkedIn analytics structure
    const metrics = response.data || {};
    
    const impressions = metrics.impressionCount || 0;
    const likes = metrics.likeCount || 0;
    const comments = metrics.commentCount || 0;
    const shares = metrics.shareCount || 0;
    const engagement = likes + comments + shares;

    return {
      views: metrics.viewCount || impressions,
      likes,
      comments,
      shares,
      engagement,
      clicks: metrics.clickCount || 0,
      impressions,
      reach: metrics.reachCount || impressions,
      uniqueReach: metrics.uniqueReachCount || impressions,
      engagementBreakdown: {
        likes,
        comments,
        shares,
        saves: metrics.saveCount || 0,
        clicks: metrics.clickCount || 0,
        reactions: likes,
        retweets: 0,
        views: metrics.viewCount || 0
      },
      syncedAt: new Date(),
    };
  } catch (error) {
    logger.error('LinkedIn analytics sync error', { error: error.message, userId, postId });
    captureException(error, { tags: { platform: 'linkedin', operation: 'analytics_sync' } });
    throw error;
  }
}

/**
 * Sync analytics from Facebook
 */
async function syncFacebookAnalytics(userId, postId, platformPostId) {
  try {
    const accessToken = await getValidAccessToken(userId, 'facebook');
    
    // Facebook Graph API - Get post insights
    const response = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}/insights`, {
      params: {
        metric: 'post_impressions,post_engaged_users,post_clicks',
        access_token: accessToken,
      },
    });

    const insights = response.data.data || [];
    const metrics = {};
    
    insights.forEach(insight => {
      if (insight.name === 'post_impressions') {
        metrics.impressions = parseInt(insight.values[0]?.value || 0);
      } else if (insight.name === 'post_engaged_users') {
        metrics.engagement = parseInt(insight.values[0]?.value || 0);
      } else if (insight.name === 'post_clicks') {
        metrics.clicks = parseInt(insight.values[0]?.value || 0);
      } else if (insight.name === 'post_reach') {
        metrics.reach = parseInt(insight.values[0]?.value || 0);
      }
    });

    // Get post reactions
    const reactionsResponse = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
      params: {
        fields: 'reactions.summary(true),comments.summary(true),shares',
        access_token: accessToken,
      },
    });

    const reactions = reactionsResponse.data.reactions?.summary?.total_count || 0;
    const comments = reactionsResponse.data.comments?.summary?.total_count || 0;
    const shares = reactionsResponse.data.shares?.count || 0;

    const impressions = metrics.impressions || 0;
    const engagement = reactions + comments + shares;

    return {
      views: impressions,
      likes: reactions,
      comments,
      shares,
      engagement,
      clicks: metrics.clicks || 0,
      impressions,
      reach: metrics.reach || impressions, // Facebook provides reach separately
      uniqueReach: metrics.uniqueReach || impressions,
      engagementBreakdown: {
        likes: reactions,
        comments,
        shares,
        saves: 0, // Would need additional API call
        clicks: metrics.clicks || 0,
        reactions,
        retweets: 0,
        views: impressions
      },
      syncedAt: new Date(),
    };
  } catch (error) {
    logger.error('Facebook analytics sync error', { error: error.message, userId, postId });
    captureException(error, { tags: { platform: 'facebook', operation: 'analytics_sync' } });
    throw error;
  }
}

/**
 * Sync analytics for a post from its platform
 */
async function syncPostAnalytics(userId, postId) {
  try {
    const post = await ScheduledPost.findOne({
      _id: postId,
      userId,
    });

    if (!post || !post.platformPostId) {
      throw new Error('Post not found or not published');
    }

    let analytics;
    switch (post.platform.toLowerCase()) {
      case 'twitter':
        analytics = await syncTwitterAnalytics(userId, postId, post.platformPostId);
        break;
      case 'linkedin':
        analytics = await syncLinkedInAnalytics(userId, postId, post.platformPostId);
        break;
      case 'facebook':
      case 'instagram':
        analytics = await syncFacebookAnalytics(userId, postId, post.platformPostId);
        break;
      default:
        throw new Error(`Analytics sync not supported for platform: ${post.platform}`);
    }

    // Update post with synced analytics
    post.analytics = {
      ...post.analytics,
      ...analytics,
    };
    post.lastAnalyticsSync = new Date();
    await post.save();

    // Update content performance
    try {
      const { updateContentPerformance } = require('./topPerformingPostsService');
      await updateContentPerformance(post._id);
    } catch (error) {
      logger.warn('Error updating content performance', { error: error.message });
    }

    logger.info('Post analytics synced', { postId, platform: post.platform, userId });
    return analytics;
  } catch (error) {
    logger.error('Post analytics sync error', { error: error.message, postId, userId });
    throw error;
  }
}

/**
 * Sync analytics for all user posts
 */
async function syncAllUserAnalytics(userId, limit = 50) {
  try {
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      platformPostId: { $exists: true, $ne: null },
    })
      .sort({ postedAt: -1 })
      .limit(limit);

    logger.info('Syncing analytics for user posts', { userId, count: posts.length });

    const results = {
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const post of posts) {
      try {
        await syncPostAnalytics(userId, post._id);
        results.synced++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          postId: post._id,
          platform: post.platform,
          error: error.message,
        });
      }
    }

    logger.info('Analytics sync complete', { userId, ...results });
    return results;
  } catch (error) {
    logger.error('Sync all analytics error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get audience insights (aggregated from platforms)
 */
async function getAudienceInsights(userId, period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate },
      analytics: { $exists: true },
    });

    const insights = {
      totalPosts: posts.length,
      totalReach: 0,
      totalEngagement: 0,
      averageEngagementRate: 0,
      topPlatform: null,
      bestPostingTime: null,
      audienceGrowth: 0,
      engagementByPlatform: {},
      reachByPlatform: {},
      engagementByDayOfWeek: {},
      engagementByHour: {},
    };

    let totalReach = 0;
    let totalEngagement = 0;
    const platformStats = {};

    posts.forEach(post => {
      if (post.analytics) {
        const reach = post.analytics.impressions || post.analytics.views || 0;
        const engagement = post.analytics.engagement || 0;

        totalReach += reach;
        totalEngagement += engagement;

        // Platform breakdown
        if (!platformStats[post.platform]) {
          platformStats[post.platform] = { reach: 0, engagement: 0, posts: 0 };
        }
        platformStats[post.platform].reach += reach;
        platformStats[post.platform].engagement += engagement;
        platformStats[post.platform].posts++;

        // Day of week analysis
        if (post.postedAt) {
          const dayOfWeek = new Date(post.postedAt).getDay();
          if (!insights.engagementByDayOfWeek[dayOfWeek]) {
            insights.engagementByDayOfWeek[dayOfWeek] = 0;
          }
          insights.engagementByDayOfWeek[dayOfWeek] += engagement;
        }

        // Hour analysis
        if (post.postedAt) {
          const hour = new Date(post.postedAt).getHours();
          if (!insights.engagementByHour[hour]) {
            insights.engagementByHour[hour] = 0;
          }
          insights.engagementByHour[hour] += engagement;
        }
      }
    });

    insights.totalReach = totalReach;
    insights.totalEngagement = totalEngagement;
    insights.averageEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;
    insights.engagementByPlatform = Object.fromEntries(
      Object.entries(platformStats).map(([platform, stats]) => [
        platform,
        stats.posts > 0 ? stats.engagement / stats.posts : 0,
      ])
    );
    insights.reachByPlatform = Object.fromEntries(
      Object.entries(platformStats).map(([platform, stats]) => [
        platform,
        stats.posts > 0 ? stats.reach / stats.posts : 0,
      ])
    );

    // Find top platform
    const topPlatform = Object.entries(platformStats).sort(
      (a, b) => b[1].engagement - a[1].engagement
    )[0];
    if (topPlatform) {
      insights.topPlatform = topPlatform[0];
    }

    // Find best posting time
    const bestHour = Object.entries(insights.engagementByHour).sort(
      (a, b) => b[1] - a[1]
    )[0];
    if (bestHour) {
      insights.bestPostingTime = `${bestHour[0]}:00`;
    }

    return insights;
  } catch (error) {
    logger.error('Get audience insights error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  syncPostAnalytics,
  syncAllUserAnalytics,
  getAudienceInsights,
  syncTwitterAnalytics,
  syncLinkedInAnalytics,
  syncFacebookAnalytics,
};







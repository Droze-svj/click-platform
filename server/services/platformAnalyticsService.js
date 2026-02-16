// Platform analytics service - sync real-time data from social platforms

const SocialConnection = require('../models/SocialConnection');
const ScheduledPost = require('../models/ScheduledPost');
const { getValidAccessToken } = require('./tokenRefreshService');
const axios = require('axios');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/** Get access token for a platform - SocialConnection (MongoDB) or platform_accounts (Supabase) */
async function getAccessTokenForPlatform(userId, platform) {
  const plat = platform.toLowerCase();
  if (['twitter', 'linkedin', 'facebook', 'instagram'].includes(plat)) {
    return await getValidAccessToken(userId, plat);
  }
  if (['youtube', 'tiktok'].includes(plat)) {
    const { createClient } = require('@supabase/supabase-js');
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured for platform analytics');
    }
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data, error } = await supabase
      .from('platform_accounts')
      .select('access_token, token_expires_at, refresh_token')
      .eq('user_id', userId.toString())
      .eq('platform', plat)
      .eq('is_connected', true)
      .limit(1)
      .maybeSingle();
    if (error || !data?.access_token) {
      throw new Error(`No active ${plat} connection found`);
    }
    return data.access_token;
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

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
 * Sync analytics from YouTube (Data API v3 - videos.list statistics)
 */
async function syncYouTubeAnalytics(userId, postId, platformPostId) {
  try {
    const accessToken = await getAccessTokenForPlatform(userId, 'youtube');

    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'statistics',
        id: platformPostId,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const items = response.data?.items || [];
    if (items.length === 0) {
      throw new Error(`YouTube video ${platformPostId} not found`);
    }

    const stats = items[0].statistics || {};
    const views = parseInt(stats.viewCount || 0, 10);
    const likes = parseInt(stats.likeCount || 0, 10);
    const comments = parseInt(stats.commentCount || 0, 10);
    const engagement = likes + comments;

    return {
      views,
      likes,
      comments,
      engagement,
      impressions: views,
      reach: views,
      uniqueReach: views,
      engagementBreakdown: {
        likes,
        comments,
        shares: 0,
        retweets: 0,
        saves: 0,
        clicks: 0,
        reactions: likes,
      },
      syncedAt: new Date(),
    };
  } catch (error) {
    logger.error('YouTube analytics sync error', { error: error.message, userId, postId });
    captureException(error, { tags: { platform: 'youtube', operation: 'analytics_sync' } });
    throw error;
  }
}

/**
 * Sync analytics from TikTok
 * Uses TikTok Content Posting API video list when available; otherwise returns placeholder.
 */
async function syncTikTokAnalytics(userId, postId, platformPostId) {
  try {
    const accessToken = await getAccessTokenForPlatform(userId, 'tiktok');

    try {
      const response = await axios.post(
        'https://open.tiktokapis.com/v2/video/list/?fields=id,view_count,like_count,comment_count,share_count',
        { max_count: 20 },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const items = response.data?.data?.videos || [];
      const v = items.find((item) => item.id === platformPostId);
      if (!v) {
        throw new Error(`TikTok video ${platformPostId} not found in list`);
      }
      const views = parseInt(v.view_count || 0, 10);
      const likes = parseInt(v.like_count || 0, 10);
      const comments = parseInt(v.comment_count || 0, 10);
      const shares = parseInt(v.share_count || 0, 10);
      const engagement = likes + comments + shares;

      return {
        views,
        likes,
        comments,
        shares,
        engagement,
        impressions: views,
        reach: views,
        uniqueReach: views,
        engagementBreakdown: {
          likes,
          comments,
          shares,
          retweets: 0,
          saves: 0,
          clicks: 0,
          reactions: likes,
        },
        syncedAt: new Date(),
      };
    } catch (apiErr) {
      if (apiErr.response?.status === 401 || apiErr.response?.data?.error?.code === 40101) {
        throw apiErr;
      }
      logger.warn('TikTok video/list API not available, using placeholder', {
        error: apiErr.message,
        platformPostId,
      });
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0,
        impressions: 0,
        reach: 0,
        uniqueReach: 0,
        engagementBreakdown: { likes: 0, comments: 0, shares: 0, retweets: 0, saves: 0, clicks: 0, reactions: 0 },
        syncedAt: new Date(),
        _note: 'TikTok analytics require video.list scope; sync when API is configured',
      };
    }
  } catch (error) {
    logger.error('TikTok analytics sync error', { error: error.message, userId, postId });
    captureException(error, { tags: { platform: 'tiktok', operation: 'analytics_sync' } });
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
      case 'youtube':
        analytics = await syncYouTubeAnalytics(userId, postId, post.platformPostId);
        break;
      case 'tiktok':
        analytics = await syncTikTokAnalytics(userId, postId, post.platformPostId);
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
  syncYouTubeAnalytics,
  syncTikTokAnalytics,
};







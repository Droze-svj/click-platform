// Social Performance Metrics Service
// Calculate reach, impressions, engagement rates, and audience growth

const ScheduledPost = require('../models/ScheduledPost');
const AudienceGrowth = require('../models/AudienceGrowth');
const SocialConnection = require('../models/SocialConnection');
const logger = require('../utils/logger');

/**
 * Calculate engagement rate for a post
 */
async function calculateEngagementRate(postId, options = {}) {
  try {
    const {
      method = 'byReach' // 'byReach', 'byImpressions', 'byFollowers', 'all'
    } = options;

    const post = await ScheduledPost.findById(postId);
    if (!post || !post.analytics) {
      throw new Error('Post not found or no analytics data');
    }

    const analytics = post.analytics;
    const engagement = analytics.engagement || 0;
    const engagementBreakdown = analytics.engagementBreakdown || {};

    // Calculate total engagement if not set
    if (engagement === 0 && engagementBreakdown) {
      analytics.engagement = 
        (engagementBreakdown.likes || 0) +
        (engagementBreakdown.comments || 0) +
        (engagementBreakdown.shares || 0) +
        (engagementBreakdown.saves || 0) +
        (engagementBreakdown.reactions || 0) +
        (engagementBreakdown.retweets || 0);
    }

    const rates = {};

    // Engagement rate by reach
    if (analytics.reach > 0) {
      rates.byReach = (analytics.engagement / analytics.reach) * 100;
    }

    // Engagement rate by impressions
    if (analytics.impressions > 0) {
      rates.byImpressions = (analytics.engagement / analytics.impressions) * 100;
    }

    // Engagement rate by followers
    if (analytics.followersAtPost > 0) {
      rates.byFollowers = (analytics.engagement / analytics.followersAtPost) * 100;
    }

    // Update post analytics
    analytics.engagementRate = rates;
    analytics.lastUpdated = new Date();
    post.markModified('analytics');
    await post.save();

    return {
      engagement: analytics.engagement,
      rates: method === 'all' ? rates : { [method]: rates[method] || 0 },
      breakdown: engagementBreakdown
    };
  } catch (error) {
    logger.error('Error calculating engagement rate', { error: error.message, postId });
    throw error;
  }
}

/**
 * Update post analytics with reach and impressions
 */
async function updateReachAndImpressions(postId, data) {
  try {
    const {
      impressions,
      reach,
      uniqueReach
    } = data;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    if (!post.analytics) {
      post.analytics = {};
    }

    if (impressions !== undefined) post.analytics.impressions = impressions;
    if (reach !== undefined) post.analytics.reach = reach;
    if (uniqueReach !== undefined) post.analytics.uniqueReach = uniqueReach;

    // Recalculate engagement rates
    if (post.analytics.engagement) {
      if (post.analytics.reach > 0) {
        post.analytics.engagementRate = post.analytics.engagementRate || {};
        post.analytics.engagementRate.byReach = 
          (post.analytics.engagement / post.analytics.reach) * 100;
      }
      if (post.analytics.impressions > 0) {
        post.analytics.engagementRate = post.analytics.engagementRate || {};
        post.analytics.engagementRate.byImpressions = 
          (post.analytics.engagement / post.analytics.impressions) * 100;
      }
    }

    post.analytics.lastUpdated = new Date();
    post.markModified('analytics');
    await post.save();

    return post.analytics;
  } catch (error) {
    logger.error('Error updating reach and impressions', { error: error.message, postId });
    throw error;
  }
}

/**
 * Update engagement breakdown
 */
async function updateEngagementBreakdown(postId, breakdown) {
  try {
    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    if (!post.analytics) {
      post.analytics = {};
    }

    if (!post.analytics.engagementBreakdown) {
      post.analytics.engagementBreakdown = {};
    }

    // Update breakdown
    Object.keys(breakdown).forEach(key => {
      if (post.analytics.engagementBreakdown.hasOwnProperty(key)) {
        post.analytics.engagementBreakdown[key] = breakdown[key];
      }
    });

    // Recalculate total engagement
    post.analytics.engagement = 
      (post.analytics.engagementBreakdown.likes || 0) +
      (post.analytics.engagementBreakdown.comments || 0) +
      (post.analytics.engagementBreakdown.shares || 0) +
      (post.analytics.engagementBreakdown.saves || 0) +
      (post.analytics.engagementBreakdown.clicks || 0) +
      (post.analytics.engagementBreakdown.reactions || 0) +
      (post.analytics.engagementBreakdown.retweets || 0);

    // Recalculate engagement rates
    await calculateEngagementRate(postId, { method: 'all' });

    return post.analytics;
  } catch (error) {
    logger.error('Error updating engagement breakdown', { error: error.message, postId });
    throw error;
  }
}

/**
 * Record audience growth snapshot
 */
async function recordAudienceGrowth(userId, platform, data) {
  try {
    const {
      platformAccountId,
      followers,
      following = 0,
      newFollowers = 0,
      lostFollowers = 0,
      period = 'daily',
      metadata = {}
    } = data;

    // Get previous snapshot
    const previousSnapshot = await AudienceGrowth.findOne({
      userId,
      platform,
      platformAccountId
    })
      .sort({ snapshotDate: -1 })
      .lean();

    const previousFollowers = previousSnapshot?.followers?.current || followers;

    // Calculate metrics
    const netGrowth = newFollowers - lostFollowers;
    const change = followers - previousFollowers;

    const growth = new AudienceGrowth({
      userId,
      platform,
      platformAccountId,
      followers: {
        current: followers,
        previous: previousFollowers,
        change,
        changePercentage: previousFollowers > 0 ? (change / previousFollowers) * 100 : 0
      },
      following,
      growth: {
        newFollowers,
        lostFollowers,
        netGrowth,
        growthRate: previousFollowers > 0 ? (netGrowth / previousFollowers) * 100 : 0,
        churnRate: previousFollowers > 0 ? (lostFollowers / previousFollowers) * 100 : 0
      },
      period: {
        type: period,
        startDate: period === 'daily' ? new Date() : getPeriodStart(period),
        endDate: new Date()
      },
      metadata
    });

    await growth.save();

    logger.info('Audience growth recorded', { userId, platform, followers, change });
    return growth;
  } catch (error) {
    logger.error('Error recording audience growth', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Get audience growth trends
 */
async function getAudienceGrowthTrends(userId, platform, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      period = 'daily'
    } = filters;

    const query = { userId, platform };
    if (startDate || endDate) {
      query.snapshotDate = {};
      if (startDate) query.snapshotDate.$gte = new Date(startDate);
      if (endDate) query.snapshotDate.$lte = new Date(endDate);
    }
    if (period) {
      query['period.type'] = period;
    }

    const snapshots = await AudienceGrowth.find(query)
      .sort({ snapshotDate: 1 })
      .lean();

    // Calculate trends
    const trends = {
      totalGrowth: 0,
      averageGrowthRate: 0,
      averageChurnRate: 0,
      totalNewFollowers: 0,
      totalLostFollowers: 0,
      currentFollowers: 0,
      growthVelocity: [], // Growth over time
      churnVelocity: [] // Churn over time
    };

    if (snapshots.length > 0) {
      const first = snapshots[0];
      const last = snapshots[snapshots.length - 1];
      
      trends.totalGrowth = last.followers.current - first.followers.current;
      trends.currentFollowers = last.followers.current;

      let totalGrowthRate = 0;
      let totalChurnRate = 0;
      
      snapshots.forEach(snapshot => {
        trends.totalNewFollowers += snapshot.growth.newFollowers || 0;
        trends.totalLostFollowers += snapshot.growth.lostFollowers || 0;
        totalGrowthRate += snapshot.growth.growthRate || 0;
        totalChurnRate += snapshot.growth.churnRate || 0;

        trends.growthVelocity.push({
          date: snapshot.snapshotDate,
          growth: snapshot.growth.netGrowth,
          growthRate: snapshot.growth.growthRate
        });

        trends.churnVelocity.push({
          date: snapshot.snapshotDate,
          churn: snapshot.growth.lostFollowers,
          churnRate: snapshot.growth.churnRate
        });
      });

      trends.averageGrowthRate = totalGrowthRate / snapshots.length;
      trends.averageChurnRate = totalChurnRate / snapshots.length;
    }

    return {
      snapshots,
      trends,
      summary: {
        period: {
          start: snapshots[0]?.snapshotDate,
          end: snapshots[snapshots.length - 1]?.snapshotDate
        },
        totalSnapshots: snapshots.length
      }
    };
  } catch (error) {
    logger.error('Error getting audience growth trends', { error: error.message, userId, platform });
    throw error;
  }
}

/**
 * Get period start date
 */
function getPeriodStart(period) {
  const now = new Date();
  switch (period) {
    case 'weekly':
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek;
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return new Date(now.setHours(0, 0, 0, 0));
  }
}

/**
 * Get aggregated performance metrics
 */
async function getAggregatedPerformanceMetrics(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      platform = null
    } = filters;

    const query = {
      workspaceId,
      status: 'posted',
      'analytics.impressions': { $exists: true, $gt: 0 }
    };

    if (platform) query.platform = platform;
    if (startDate || endDate) {
      query.postedAt = {};
      if (startDate) query.postedAt.$gte = new Date(startDate);
      if (endDate) query.postedAt.$lte = new Date(endDate);
    }

    const posts = await ScheduledPost.find(query).lean();

    // Aggregate metrics
    const metrics = {
      totalPosts: posts.length,
      totalImpressions: 0,
      totalReach: 0,
      totalEngagement: 0,
      averageEngagementRate: {
        byReach: 0,
        byImpressions: 0,
        byFollowers: 0
      },
      engagementBreakdown: {
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        clicks: 0,
        reactions: 0,
        retweets: 0
      },
      byPlatform: {}
    };

    let totalReachForRate = 0;
    let totalImpressionsForRate = 0;
    let totalFollowersForRate = 0;
    let postsWithReach = 0;
    let postsWithImpressions = 0;
    let postsWithFollowers = 0;

    posts.forEach(post => {
      const analytics = post.analytics || {};
      
      metrics.totalImpressions += analytics.impressions || 0;
      metrics.totalReach += analytics.reach || 0;
      metrics.totalEngagement += analytics.engagement || 0;

      // Engagement breakdown
      if (analytics.engagementBreakdown) {
        Object.keys(analytics.engagementBreakdown).forEach(key => {
          if (metrics.engagementBreakdown.hasOwnProperty(key)) {
            metrics.engagementBreakdown[key] += analytics.engagementBreakdown[key] || 0;
          }
        });
      }

      // Platform breakdown
      if (!metrics.byPlatform[post.platform]) {
        metrics.byPlatform[post.platform] = {
          posts: 0,
          impressions: 0,
          reach: 0,
          engagement: 0,
          engagementRate: { byReach: 0, byImpressions: 0 }
        };
      }

      const platformMetrics = metrics.byPlatform[post.platform];
      platformMetrics.posts++;
      platformMetrics.impressions += analytics.impressions || 0;
      platformMetrics.reach += analytics.reach || 0;
      platformMetrics.engagement += analytics.engagement || 0;

      // Calculate engagement rates
      if (analytics.engagementRate) {
        if (analytics.reach > 0) {
          totalReachForRate += analytics.reach;
          postsWithReach++;
        }
        if (analytics.impressions > 0) {
          totalImpressionsForRate += analytics.impressions;
          postsWithImpressions++;
        }
        if (analytics.followersAtPost > 0) {
          totalFollowersForRate += analytics.followersAtPost;
          postsWithFollowers++;
        }
      }
    });

    // Calculate average engagement rates
    if (totalReachForRate > 0) {
      metrics.averageEngagementRate.byReach = 
        (metrics.totalEngagement / totalReachForRate) * 100;
    }
    if (totalImpressionsForRate > 0) {
      metrics.averageEngagementRate.byImpressions = 
        (metrics.totalEngagement / totalImpressionsForRate) * 100;
    }
    if (totalFollowersForRate > 0) {
      metrics.averageEngagementRate.byFollowers = 
        (metrics.totalEngagement / totalFollowersForRate) * 100;
    }

    // Calculate platform engagement rates
    Object.keys(metrics.byPlatform).forEach(platform => {
      const platformMetrics = metrics.byPlatform[platform];
      if (platformMetrics.reach > 0) {
        platformMetrics.engagementRate.byReach = 
          (platformMetrics.engagement / platformMetrics.reach) * 100;
      }
      if (platformMetrics.impressions > 0) {
        platformMetrics.engagementRate.byImpressions = 
          (platformMetrics.engagement / platformMetrics.impressions) * 100;
      }
    });

    return metrics;
  } catch (error) {
    logger.error('Error getting aggregated performance metrics', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  calculateEngagementRate,
  updateReachAndImpressions,
  updateEngagementBreakdown,
  recordAudienceGrowth,
  getAudienceGrowthTrends,
  getAggregatedPerformanceMetrics
};



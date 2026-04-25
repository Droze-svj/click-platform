// Real-Time Engagement Service
// Monitor engagement in real-time and send alerts

const ScheduledPost = require('../models/ScheduledPost');
const NotificationService = require('./notificationService');
const { getIO } = require('./socketService');
const logger = require('../utils/logger');

/**
 * Monitor post engagement in real-time
 */
async function monitorPostEngagement(postId, thresholds = {}) {
  try {
    const {
      engagementMilestones = [100, 500, 1000, 5000],
      engagementRateThreshold = 5.0,
      velocityThreshold = 50 // engagements per hour
    } = thresholds;

    const post = await ScheduledPost.findById(postId)
      .populate('userId')
      .populate('workspaceId')
      .lean();

    if (!post || post.status !== 'posted') {
      return;
    }

    const analytics = post.analytics || {};
    const engagement = analytics.engagement || 0;
    const reach = analytics.reach || 0;
    const impressions = analytics.impressions || 0;

    // Calculate engagement rate
    let engagementRate = 0;
    if (reach > 0) {
      engagementRate = (engagement / reach) * 100;
    } else if (impressions > 0) {
      engagementRate = (engagement / impressions) * 100;
    }

    // Check milestones
    const reachedMilestones = engagementMilestones.filter(milestone => 
      engagement >= milestone && (!post.lastMilestoneReached || post.lastMilestoneReached < milestone)
    );

    if (reachedMilestones.length > 0) {
      const highestMilestone = Math.max(...reachedMilestones);
      
      // Send notification
      try {
        NotificationService.notifyUser(post.userId.toString(), {
          type: 'engagement_milestone',
          title: 'Engagement Milestone Reached!',
          message: `Your post reached ${highestMilestone} engagements!`,
          data: {
            postId: postId.toString(),
            milestone: highestMilestone,
            engagement
          }
        });
      } catch (error) {
        logger.warn('Error sending notification', { error: error.message });
      }

      // Emit real-time update
      try {
        const io = getIO();
        if (io) {
          io.to(`user-${post.userId}`).emit('engagement:milestone', {
            postId,
            milestone: highestMilestone,
            engagement
          });
        }
      } catch (error) {
        logger.warn('Error emitting engagement milestone', { error: error.message });
      }

      // Update post
      await ScheduledPost.findByIdAndUpdate(postId, {
        $set: { lastMilestoneReached: highestMilestone }
      });
    }

    // Check engagement rate threshold
    if (engagementRate >= engagementRateThreshold && (!post.highEngagementNotified || !post.highEngagementNotified)) {
      try {
        NotificationService.notifyUser(post.userId.toString(), {
          type: 'high_engagement_rate',
          title: 'High Engagement Rate!',
          message: `Your post has an engagement rate of ${engagementRate.toFixed(2)}%`,
          data: { postId: postId.toString(), engagementRate }
        });
      } catch (error) {
        logger.warn('Error sending notification', { error: error.message });
      }

      await ScheduledPost.findByIdAndUpdate(postId, {
        $set: { highEngagementNotified: true }
      });
    }

    // Calculate engagement velocity
    if (post.postedAt) {
      const hoursSincePost = (new Date() - new Date(post.postedAt)) / (1000 * 60 * 60);
      if (hoursSincePost > 0) {
        const velocity = engagement / hoursSincePost;
        
        if (velocity >= velocityThreshold && (!post.highVelocityNotified || !post.highVelocityNotified)) {
          try {
            NotificationService.notifyUser(post.userId.toString(), {
              type: 'high_engagement_velocity',
              title: 'Viral Engagement!',
              message: `Your post is getting ${Math.round(velocity)} engagements per hour!`,
              data: { postId: postId.toString(), velocity: Math.round(velocity) }
            });
          } catch (error) {
            logger.warn('Error sending notification', { error: error.message });
          }

          await ScheduledPost.findByIdAndUpdate(postId, {
            $set: { highVelocityNotified: true }
          });
        }
      }
    }

    return {
      engagement,
      engagementRate,
      milestones: reachedMilestones
    };
  } catch (error) {
    logger.error('Error monitoring post engagement', { error: error.message, postId });
    throw error;
  }
}

/**
 * Get real-time engagement dashboard
 */
async function getRealTimeEngagementDashboard(workspaceId, filters = {}) {
  try {
    const {
      platform = null,
      hours = 24
    } = filters;

    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const query = {
      workspaceId,
      status: 'posted',
      postedAt: { $gte: startDate },
      'analytics.engagement': { $exists: true, $gt: 0 }
    };

    if (platform) query.platform = platform;

    const posts = await ScheduledPost.find(query)
      .sort({ 'analytics.engagement': -1 })
      .limit(20)
      .lean();

    // Calculate real-time metrics
    const dashboard = {
      totalEngagement: 0,
      averageEngagementRate: 0,
      topPosts: [],
      engagementVelocity: [],
      byPlatform: {}
    };

    let totalReach = 0;
    let totalEngagement = 0;

    posts.forEach(post => {
      const analytics = post.analytics || {};
      dashboard.totalEngagement += analytics.engagement || 0;
      totalReach += analytics.reach || 0;
      totalEngagement += analytics.engagement || 0;

      // Calculate velocity
      if (post.postedAt) {
        const hoursSincePost = (new Date() - new Date(post.postedAt)) / (1000 * 60 * 60);
        if (hoursSincePost > 0) {
          const velocity = (analytics.engagement || 0) / hoursSincePost;
          dashboard.engagementVelocity.push({
            postId: post._id,
            velocity: Math.round(velocity),
            engagement: analytics.engagement,
            hoursSincePost: Math.round(hoursSincePost * 10) / 10
          });
        }
      }

      // Platform breakdown
      if (!dashboard.byPlatform[post.platform]) {
        dashboard.byPlatform[post.platform] = {
          posts: 0,
          engagement: 0,
          averageRate: 0
        };
      }
      dashboard.byPlatform[post.platform].posts++;
      dashboard.byPlatform[post.platform].engagement += analytics.engagement || 0;
    });

    if (totalReach > 0) {
      dashboard.averageEngagementRate = (totalEngagement / totalReach) * 100;
    }

    // Calculate platform averages
    Object.keys(dashboard.byPlatform).forEach(platform => {
      const platformData = dashboard.byPlatform[platform];
      // Would need to get platform reach for accurate rate
      platformData.averageRate = 0; // Placeholder
    });

    // Top posts
    dashboard.topPosts = posts.slice(0, 10).map(post => ({
      postId: post._id,
      platform: post.platform,
      engagement: post.analytics?.engagement || 0,
      engagementRate: post.analytics?.engagementRate?.byReach || 0,
      postedAt: post.postedAt
    }));

    return dashboard;
  } catch (error) {
    logger.error('Error getting real-time engagement dashboard', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  monitorPostEngagement,
  getRealTimeEngagementDashboard
};


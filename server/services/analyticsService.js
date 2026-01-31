// Analytics Service (Privacy-Compliant)

const mongoose = require('mongoose');
const User = require('../models/User');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Track user event (privacy-compliant)
 */
async function trackEvent(userId, eventType, metadata = {}) {
  try {
    // Skip tracking for dev users to avoid MongoDB CastErrors
    if (userId && (userId.toString().startsWith('dev-') || userId.toString().startsWith('test-') || userId.toString() === 'dev-user-123')) {
      logger.debug('Analytics tracking skipped - dev user', { userId, eventType });
      return { tracked: false, reason: 'dev_user' };
    }
    
    // Only track if user has analytics consent
    let user;
    try {
      user = await User.findById(userId).select('privacy.analyticsConsent');
    } catch (dbError) {
      // If it's a CastError, skip tracking
      if (dbError.name === 'CastError' || dbError.message?.includes('Cast to ObjectId')) {
        logger.debug('Analytics tracking skipped - CastError', { userId, eventType, error: dbError.message });
        return { tracked: false, reason: 'cast_error' };
      }
      throw dbError;
    }
    
    if (!user || !user.privacy?.analyticsConsent) {
      logger.debug('Analytics tracking skipped - user opted out', { userId, eventType });
      return { tracked: false, reason: 'user_opted_out' };
    }

    // Anonymize sensitive data
    const anonymizedMetadata = {
      ...metadata,
      // Remove any PII
      email: undefined,
      name: undefined,
      ip: undefined,
    };

    // Store event (in production, use analytics service like Google Analytics, Plausible, etc.)
    logger.info('Event tracked', {
      userId,
      eventType,
      metadata: anonymizedMetadata,
      timestamp: new Date(),
    });

    // In production, send to analytics service
    // await sendToAnalyticsService(userId, eventType, anonymizedMetadata);

    return { tracked: true };
  } catch (error) {
    logger.error('Analytics tracking error', { error: error.message, userId, eventType });
    return { tracked: false, error: error.message };
  }
}

/**
 * Get user analytics (aggregated, privacy-compliant)
 */
async function getUserAnalytics(userId, timeRange = '30d') {
  try {
    // Handle dev users - return mock data to avoid MongoDB CastErrors
    if (userId && (userId.toString().startsWith('dev-') || userId.toString().startsWith('test-') || userId.toString() === 'dev-user-123')) {
      return {
        timeRange: `${parseInt(timeRange) || 30} days`,
        content: { created: 0, scheduled: 0, published: 0 },
        usage: { videosProcessed: 0, contentGenerated: 0, quotesCreated: 0, postsScheduled: 0, scriptsGenerated: 0 },
        timestamp: new Date()
      };
    }
    
    // Wrap in try-catch to handle CastErrors
    let user;
    try {
      user = await User.findById(userId).select('privacy.analyticsConsent');
    } catch (dbError) {
      // If it's a CastError, return mock data
      if (dbError.name === 'CastError' || dbError.message?.includes('Cast to ObjectId')) {
        logger.warn('CastError in getUserAnalytics, returning mock data', { error: dbError.message, userId });
        return {
          timeRange: `${parseInt(timeRange) || 30} days`,
          content: { created: 0, scheduled: 0, published: 0 },
          usage: { videosProcessed: 0, contentGenerated: 0, quotesCreated: 0, postsScheduled: 0, scriptsGenerated: 0 },
          timestamp: new Date()
        };
      }
      throw dbError;
    }
    
    if (!user || !user.privacy?.analyticsConsent) {
      return { error: 'Analytics not enabled for this user' };
    }

    const days = parseInt(timeRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate data
    const contentCreated = await Content.countDocuments({
      userId,
      createdAt: { $gte: startDate },
    });

    const postsScheduled = await ScheduledPost.countDocuments({
      userId,
      createdAt: { $gte: startDate },
    });

    const postsPublished = await ScheduledPost.countDocuments({
      userId,
      status: 'published',
      createdAt: { $gte: startDate },
    });

    // Usage statistics
    const userDoc = await User.findById(userId).select('usage');
    const usage = userDoc?.usage || {};

    return {
      timeRange: `${days} days`,
      content: {
        created: contentCreated,
        scheduled: postsScheduled,
        published: postsPublished,
      },
      usage: {
        videosProcessed: usage.videosProcessed || 0,
        contentGenerated: usage.contentGenerated || 0,
        quotesCreated: usage.quotesCreated || 0,
        postsScheduled: usage.postsScheduled || 0,
        scriptsGenerated: usage.scriptsGenerated || 0,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Get user analytics error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get platform analytics (aggregated across all users)
 */
async function getPlatformAnalytics(timeRange = '30d') {
  try {
    const days = parseInt(timeRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Only count users who have analytics consent
    const usersWithConsent = await User.countDocuments({
      'privacy.analyticsConsent': true,
    });

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: startDate },
    });

    const totalContent = await Content.countDocuments({
      createdAt: { $gte: startDate },
    });

    const totalPosts = await ScheduledPost.countDocuments({
      createdAt: { $gte: startDate },
    });

    return {
      timeRange: `${days} days`,
      users: {
        total: totalUsers,
        active: activeUsers,
        withAnalyticsConsent: usersWithConsent,
      },
      content: {
        total: totalContent,
        posts: totalPosts,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Get platform analytics error', { error: error.message });
    throw error;
  }
}

/**
 * Track page view (privacy-compliant)
 */
async function trackPageView(userId, page, metadata = {}) {
  return trackEvent(userId, 'page_view', {
    page,
    ...metadata,
  });
}

/**
 * Track feature usage
 */
async function trackFeatureUsage(userId, feature, metadata = {}) {
  return trackEvent(userId, 'feature_used', {
    feature,
    ...metadata,
  });
}

/**
 * Get comprehensive analytics (enhanced version of user analytics)
 */
async function getComprehensiveAnalytics(userId, period = 30) {
  // #region agent log
  // #endregion

  try {
    const analytics = await getUserAnalytics(userId, `${period}d`);

    // Add additional comprehensive data
    const user = await User.findById(userId).select('createdAt lastLogin usage subscription');
    if (!user) {
      return { error: 'User not found' };
    }
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get detailed content breakdown
    const contentBreakdown = await Content.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          types: { $addToSet: '$type' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get platform-specific posting stats
    const platformStats = await ScheduledPost.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$platform',
          total: { $sum: 1 },
          published: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          scheduled: {
            $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
          }
        }
      }
    ]);

    return {
      ...analytics,
      period: `${period} days`,
      user: {
        accountAge: user ? Math.floor((now - user.createdAt) / (1000 * 60 * 60 * 24)) : 0,
        lastLogin: user?.lastLogin,
        subscription: user?.subscription || null,
      },
      detailed: {
        contentBreakdown,
        platformStats,
        engagement: {
          avgContentPerDay: analytics.content.created / period,
          publishingRate: analytics.content.published / period,
        }
      }
    };
  } catch (error) {
    logger.error('Get comprehensive analytics error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get performance trends over time
 */
async function getPerformanceTrends(userId, period = 30) {
  // #region agent log
  // #endregion

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get daily content creation trends
    const contentTrends = await Content.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          contentCreated: { $sum: 1 },
          types: { $addToSet: '$type' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get daily posting trends
    const postingTrends = await ScheduledPost.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          postsScheduled: { $sum: 1 },
          postsPublished: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Calculate trends
    const contentGrowth = contentTrends.length >= 2 ?
      ((contentTrends[contentTrends.length - 1]?.contentCreated || 0) -
       (contentTrends[0]?.contentCreated || 0)) / (contentTrends.length - 1) : 0;

    const postingGrowth = postingTrends.length >= 2 ?
      ((postingTrends[postingTrends.length - 1]?.postsPublished || 0) -
       (postingTrends[0]?.postsPublished || 0)) / (postingTrends.length - 1) : 0;

    return {
      period: `${period} days`,
      trends: {
        contentCreation: contentTrends,
        postingActivity: postingTrends,
      },
      growth: {
        contentGrowth: Math.round(contentGrowth * 100) / 100,
        postingGrowth: Math.round(postingGrowth * 100) / 100,
      },
      summary: {
        totalContent: contentTrends.reduce((sum, day) => sum + day.contentCreated, 0),
        totalPosts: postingTrends.reduce((sum, day) => sum + day.postsScheduled, 0),
        publishedPosts: postingTrends.reduce((sum, day) => sum + day.postsPublished, 0),
        avgContentPerDay: Math.round(contentTrends.reduce((sum, day) => sum + day.contentCreated, 0) / period * 100) / 100,
        avgPostsPerDay: Math.round(postingTrends.reduce((sum, day) => sum + day.postsScheduled, 0) / period * 100) / 100,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Get performance trends error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  trackEvent,
  trackPageView,
  trackFeatureUsage,
  getUserAnalytics,
  getPlatformAnalytics,
  getComprehensiveAnalytics,
  getPerformanceTrends,
};

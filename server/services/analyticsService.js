// Analytics Service (Privacy-Compliant)

const User = require('../models/User');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Track user event (privacy-compliant)
 */
async function trackEvent(userId, eventType, metadata = {}) {
  try {
    // Only track if user has analytics consent
    const user = await User.findById(userId).select('privacy.analyticsConsent');
    
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
    const user = await User.findById(userId).select('privacy.analyticsConsent');
    
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

module.exports = {
  trackEvent,
  trackPageView,
  trackFeatureUsage,
  getUserAnalytics,
  getPlatformAnalytics,
};

// Always-On Library Service
// Topic playlists that drip posts where performance stays above threshold

const AlwaysOnLibrary = require('../models/AlwaysOnLibrary');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Create always-on library
 */
async function createAlwaysOnLibrary(userId, libraryData) {
  try {
    const {
      name,
      description,
      topic,
      tags = [],
      platforms = ['twitter', 'linkedin'],
      settings = {}
    } = libraryData;

    const library = new AlwaysOnLibrary({
      userId,
      name,
      description,
      topic,
      tags,
      platforms,
      settings: {
        performanceThreshold: {
          minEngagement: settings.minEngagement || 100,
          minEngagementRate: settings.minEngagementRate || 0.05,
          autoPause: settings.autoPause !== false
        },
        dripSchedule: {
          frequency: settings.frequency || 'weekly',
          daysOfWeek: settings.daysOfWeek || [1, 3, 5], // Mon, Wed, Fri
          times: settings.times || ['09:00', '14:00', '18:00'],
          timezone: settings.timezone || 'UTC'
        },
        rotation: {
          type: settings.rotationType || 'performance_based',
          minDaysBetween: settings.minDaysBetween || 30
        },
        limits: {
          maxPostsPerDay: settings.maxPostsPerDay || 3,
          maxPostsPerWeek: settings.maxPostsPerWeek || 10
        }
      },
      status: 'active'
    });

    await library.save();

    logger.info('Always-on library created', { userId, libraryId: library._id, topic });
    return library;
  } catch (error) {
    logger.error('Error creating always-on library', { error: error.message, userId });
    throw error;
  }
}

/**
 * Add content to library
 */
async function addContentToLibrary(libraryId, contentIds, userId) {
  try {
    const library = await AlwaysOnLibrary.findById(libraryId);
    if (!library || library.userId.toString() !== userId.toString()) {
      throw new Error('Library not found or unauthorized');
    }

    const contentIdsArray = Array.isArray(contentIds) ? contentIds : [contentIds];
    const added = [];

    for (const contentId of contentIdsArray) {
      // Check if already in library
      const exists = library.content.some(c => c.contentId.toString() === contentId.toString());
      if (exists) continue;

      // Get content performance
      const performance = await getContentPerformance(userId, contentId);

      library.content.push({
        contentId,
        performance,
        status: 'active'
      });

      added.push(contentId);
    }

    // Update performance stats
    library.performance.activeContent = library.content.filter(c => c.status === 'active').length;
    await library.save();

    // Trigger webhook
    const { triggerWebhook } = require('./webhookService');
    for (const contentId of added) {
      await triggerWebhook(library.userId, 'library.content_added', {
        libraryId: library._id,
        libraryName: library.name,
        contentId,
        addedAt: new Date()
      }, library.workspaceId);
    }

    logger.info('Content added to library', { libraryId, count: added.length });
    return { added, total: library.content.length };
  } catch (error) {
    logger.error('Error adding content to library', { error: error.message, libraryId });
    throw error;
  }
}

/**
 * Get content performance
 */
async function getContentPerformance(userId, contentId) {
  try {
    const posts = await ScheduledPost.find({
      userId,
      contentId,
      status: 'posted'
    })
      .sort({ postedAt: -1 })
      .limit(10)
      .lean();

    if (posts.length === 0) {
      return {
        avgEngagement: 0,
        avgEngagementRate: 0,
        postCount: 0,
        lastPosted: null
      };
    }

    let totalEngagement = 0;
    let totalImpressions = 0;
    let lastPosted = null;

    posts.forEach(post => {
      totalEngagement += post.analytics?.engagement || 0;
      totalImpressions += post.analytics?.impressions || 1;
      if (!lastPosted || post.postedAt > lastPosted) {
        lastPosted = post.postedAt;
      }
    });

    return {
      avgEngagement: totalEngagement / posts.length,
      avgEngagementRate: totalImpressions > 0 ? totalEngagement / totalImpressions : 0,
      postCount: posts.length,
      lastPosted
    };
  } catch (error) {
    logger.error('Error getting content performance', { error: error.message });
    return {
      avgEngagement: 0,
      avgEngagementRate: 0,
      postCount: 0,
      lastPosted: null
    };
  }
}

/**
 * Check and update content performance
 */
async function checkContentPerformance(libraryId) {
  try {
    const library = await AlwaysOnLibrary.findById(libraryId);
    if (!library) {
      throw new Error('Library not found');
    }

    const threshold = library.settings.performanceThreshold;
    let updated = 0;
    let paused = 0;

    for (const contentItem of library.content) {
      if (contentItem.status === 'removed') continue;

      // Update performance
      const performance = await getContentPerformance(library.userId, contentItem.contentId);
      contentItem.performance = performance;

      // Check threshold
      if (library.settings.performanceThreshold.autoPause) {
        const belowThreshold = 
          performance.avgEngagement < threshold.minEngagement ||
          performance.avgEngagementRate < threshold.minEngagementRate;

        if (belowThreshold && contentItem.status === 'active') {
          contentItem.status = 'paused';
          paused++;
          
          // Trigger webhook
          const { triggerWebhook } = require('./webhookService');
          await triggerWebhook(library.userId, 'library.content_paused', {
            libraryId: library._id,
            libraryName: library.name,
            contentId: contentItem.contentId,
            reason: 'below_threshold',
            performance: performance,
            threshold: threshold
          }, library.workspaceId);
        } else if (!belowThreshold && contentItem.status === 'paused') {
          contentItem.status = 'active';
        }
      }

      updated++;
    }

    // Update library stats
    library.performance.activeContent = library.content.filter(c => c.status === 'active').length;
    library.performance.pausedContent = library.content.filter(c => c.status === 'paused').length;

    await library.save();

    logger.info('Content performance checked', { libraryId, updated, paused });
    return { updated, paused };
  } catch (error) {
    logger.error('Error checking content performance', { error: error.message, libraryId });
    throw error;
  }
}

/**
 * Schedule next post from library
 */
async function scheduleNextPost(libraryId) {
  try {
    const library = await AlwaysOnLibrary.findById(libraryId);
    if (!library || library.status !== 'active') {
      throw new Error('Library not found or not active');
    }

    // Check limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const postsToday = await ScheduledPost.countDocuments({
      userId: library.userId,
      status: { $in: ['scheduled', 'posted'] },
      scheduledTime: { $gte: today }
    });

    const postsThisWeek = await ScheduledPost.countDocuments({
      userId: library.userId,
      status: { $in: ['scheduled', 'posted'] },
      scheduledTime: { $gte: weekStart }
    });

    if (postsToday >= library.settings.limits.maxPostsPerDay) {
      return { scheduled: false, reason: 'daily_limit_reached' };
    }

    if (postsThisWeek >= library.settings.limits.maxPostsPerWeek) {
      return { scheduled: false, reason: 'weekly_limit_reached' };
    }

    // Get next content
    const nextContentItem = library.getNextContent();
    if (!nextContentItem) {
      return { scheduled: false, reason: 'no_active_content' };
    }

    // Calculate next post time
    const nextPostTime = calculateNextPostTime(library);

    // Schedule for each platform
    const scheduled = [];
    for (const platform of library.platforms) {
      const scheduledPost = new ScheduledPost({
        userId: library.userId,
        contentId: nextContentItem.contentId,
        platform,
        scheduledTime: nextPostTime,
        timezone: library.settings.dripSchedule.timezone,
        status: 'scheduled',
        metadata: {
          alwaysOnLibrary: libraryId,
          topic: library.topic
        }
      });

      await scheduledPost.save();
      scheduled.push(scheduledPost);
    }

    // Update library
    library.lastPosted = new Date();
    library.nextPost = nextPostTime;
    library.performance.totalPosts += scheduled.length;
    await library.save();

    logger.info('Next post scheduled from library', { libraryId, contentId: nextContentItem.contentId, count: scheduled.length });
    return { scheduled: true, posts: scheduled, nextPostTime };
  } catch (error) {
    logger.error('Error scheduling next post', { error: error.message, libraryId });
    throw error;
  }
}

/**
 * Calculate next post time
 */
function calculateNextPostTime(library) {
  const now = new Date();
  const schedule = library.settings.dripSchedule;
  
  // Get next available day
  const daysOfWeek = schedule.daysOfWeek || [1, 3, 5];
  const times = schedule.times || ['09:00'];
  
  let nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + 1);

  // Find next valid day
  while (!daysOfWeek.includes(nextDate.getDay())) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  // Set time
  const [hours, minutes] = times[0].split(':');
  nextDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  return nextDate;
}

/**
 * Process all active libraries
 */
async function processActiveLibraries() {
  try {
    const libraries = await AlwaysOnLibrary.find({
      status: 'active'
    });

    const results = [];

    for (const library of libraries) {
      try {
        // Check if it's time to post
        const shouldPost = shouldPostNow(library);
        
        if (shouldPost) {
          // Check content performance first
          await checkContentPerformance(library._id);
          
          // Schedule next post
          const result = await scheduleNextPost(library._id);
          results.push({
            libraryId: library._id,
            libraryName: library.name,
            ...result
          });
        }
      } catch (error) {
        logger.error('Error processing library', { error: error.message, libraryId: library._id });
        results.push({
          libraryId: library._id,
          error: error.message
        });
      }
    }

    logger.info('Active libraries processed', { count: results.length });
    return results;
  } catch (error) {
    logger.error('Error processing active libraries', { error: error.message });
    throw error;
  }
}

/**
 * Check if should post now
 */
function shouldPostNow(library) {
  if (!library.nextPost) {
    return true;
  }

  const now = new Date();
  return now >= library.nextPost;
}

/**
 * Auto-add high-performing content to library
 */
async function autoAddHighPerformingContent(libraryId, options = {}) {
  try {
    const {
      minEngagement = 200,
      minEngagementRate = 0.08,
      daysSincePost = 7,
      maxAdd = 10
    } = options;

    const library = await AlwaysOnLibrary.findById(libraryId);
    if (!library) {
      throw new Error('Library not found');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSincePost);

    // Find high-performing content
    const posts = await ScheduledPost.find({
      userId: library.userId,
      status: 'posted',
      postedAt: { $gte: cutoffDate },
      platform: { $in: library.platforms },
      'analytics.engagement': { $gte: minEngagement }
    })
      .populate('contentId')
      .sort({ 'analytics.engagement': -1 })
      .limit(maxAdd * 2)
      .lean();

    const added = [];
    for (const post of posts) {
      if (!post.contentId) continue;

      const engagement = post.analytics?.engagement || 0;
      const impressions = post.analytics?.impressions || 1;
      const engagementRate = engagement / impressions;

      if (engagementRate < minEngagementRate) continue;

      // Check if already in library
      const exists = library.content.some(c => 
        c.contentId.toString() === post.contentId._id.toString()
      );

      if (exists) continue;

      // Get performance
      const performance = await getContentPerformance(library.userId, post.contentId._id);

      // Check threshold
      if (performance.avgEngagement >= library.settings.performanceThreshold.minEngagement) {
        library.content.push({
          contentId: post.contentId._id,
          performance,
          status: 'active'
        });
        added.push({
          contentId: post.contentId._id,
          engagement,
          engagementRate
        });
      }

      if (added.length >= maxAdd) break;
    }

    library.performance.activeContent = library.content.filter(c => c.status === 'active').length;
    await library.save();

    logger.info('High-performing content auto-added', { libraryId, count: added.length });
    return { added, total: library.content.length };
  } catch (error) {
    logger.error('Error auto-adding content', { error: error.message, libraryId });
    throw error;
  }
}

/**
 * Get library analytics
 */
async function getLibraryAnalytics(libraryId) {
  try {
    const library = await AlwaysOnLibrary.findById(libraryId);
    if (!library) {
      throw new Error('Library not found');
    }

    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get posts from library
    const posts = await ScheduledPost.find({
      userId: library.userId,
      status: 'posted',
      postedAt: { $gte: last30Days },
      'metadata.alwaysOnLibrary': libraryId
    }).lean();

    const analytics = {
      library: {
        id: library._id,
        name: library.name,
        topic: library.topic,
        status: library.status
      },
      content: {
        total: library.content.length,
        active: library.performance.activeContent,
        paused: library.performance.pausedContent,
        avgEngagement: 0,
        topPerformer: null
      },
      posts: {
        total: posts.length,
        totalEngagement: 0,
        avgEngagement: 0,
        byPlatform: {}
      },
      performance: {
        thresholdMet: 0,
        thresholdFailed: 0,
        avgEngagementRate: 0
      }
    };

    // Calculate post analytics
    let totalEngagement = 0;
    posts.forEach(post => {
      const engagement = post.analytics?.engagement || 0;
      totalEngagement += engagement;

      if (!analytics.posts.byPlatform[post.platform]) {
        analytics.posts.byPlatform[post.platform] = {
          count: 0,
          engagement: 0
        };
      }
      analytics.posts.byPlatform[post.platform].count++;
      analytics.posts.byPlatform[post.platform].engagement += engagement;
    });

    analytics.posts.totalEngagement = totalEngagement;
    analytics.posts.avgEngagement = posts.length > 0 ? totalEngagement / posts.length : 0;

    // Content analytics
    const activeContent = library.content.filter(c => c.status === 'active');
    if (activeContent.length > 0) {
      const totalContentEngagement = activeContent.reduce((sum, c) => 
        sum + (c.performance.avgEngagement || 0), 0);
      analytics.content.avgEngagement = totalContentEngagement / activeContent.length;

      // Top performer
      const sorted = activeContent.sort((a, b) => 
        (b.performance.avgEngagement || 0) - (a.performance.avgEngagement || 0)
      );
      analytics.content.topPerformer = {
        contentId: sorted[0].contentId,
        engagement: sorted[0].performance.avgEngagement
      };
    }

    // Performance threshold analysis
    const threshold = library.settings.performanceThreshold;
    activeContent.forEach(content => {
      if (content.performance.avgEngagement >= threshold.minEngagement &&
          content.performance.avgEngagementRate >= threshold.minEngagementRate) {
        analytics.performance.thresholdMet++;
      } else {
        analytics.performance.thresholdFailed++;
      }
    });

    const totalImpressions = posts.reduce((sum, p) => 
      sum + (p.analytics?.impressions || 1), 0);
    analytics.performance.avgEngagementRate = totalImpressions > 0
      ? totalEngagement / totalImpressions
      : 0;

    return analytics;
  } catch (error) {
    logger.error('Error getting library analytics', { error: error.message, libraryId });
    throw error;
  }
}

/**
 * Refresh expired content
 */
async function refreshExpiredContent(libraryId, options = {}) {
  try {
    const {
      maxAge = 365, // days
      refreshAction = 'pause' // pause, remove, or refresh
    } = options;

    const library = await AlwaysOnLibrary.findById(libraryId);
    if (!library) {
      throw new Error('Library not found');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    const refreshed = [];
    for (const contentItem of library.content) {
      if (!contentItem.performance.lastPosted) continue;

      const daysSincePost = (new Date() - new Date(contentItem.performance.lastPosted)) / (1000 * 60 * 60 * 24);
      
      if (daysSincePost > maxAge) {
        if (refreshAction === 'pause') {
          contentItem.status = 'paused';
          refreshed.push({ contentId: contentItem.contentId, action: 'paused' });
        } else if (refreshAction === 'remove') {
          contentItem.status = 'removed';
          refreshed.push({ contentId: contentItem.contentId, action: 'removed' });
        } else if (refreshAction === 'refresh') {
          // Mark for content refresh (would trigger content update workflow)
          contentItem.metadata = contentItem.metadata || {};
          contentItem.metadata.needsRefresh = true;
          refreshed.push({ contentId: contentItem.contentId, action: 'marked_for_refresh' });
        }
      }
    }

    library.performance.activeContent = library.content.filter(c => c.status === 'active').length;
    library.performance.pausedContent = library.content.filter(c => c.status === 'paused').length;
    await library.save();

    logger.info('Expired content refreshed', { libraryId, count: refreshed.length });
    return { refreshed, total: refreshed.length };
  } catch (error) {
    logger.error('Error refreshing expired content', { error: error.message, libraryId });
    throw error;
  }
}

module.exports = {
  createAlwaysOnLibrary,
  addContentToLibrary,
  checkContentPerformance,
  scheduleNextPost,
  processActiveLibraries,
  autoAddHighPerformingContent,
  getLibraryAnalytics,
  refreshExpiredContent
};


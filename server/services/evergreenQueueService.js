// Evergreen Queue Service
// Smart recycling queues per client with evergreen content detection

const EvergreenQueue = require('../models/EvergreenQueue');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const { detectEvergreenContent } = require('./evergreenDetectionService');
const logger = require('../utils/logger');

/**
 * Create evergreen queue for client
 */
async function createEvergreenQueue(clientWorkspaceId, agencyWorkspaceId, userId, queueData) {
  try {
    const queue = new EvergreenQueue({
      ...queueData,
      clientWorkspaceId,
      agencyWorkspaceId,
      createdBy: userId
    });

    await queue.save();
    logger.info('Evergreen queue created', { queueId: queue._id, clientWorkspaceId });
    return queue;
  } catch (error) {
    logger.error('Error creating evergreen queue', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Auto-populate queue with evergreen content
 */
async function populateEvergreenQueue(queueId, options = {}) {
  try {
    const queue = await EvergreenQueue.findById(queueId);
    if (!queue) {
      throw new Error('Queue not found');
    }

    const {
      minScore = queue.settings.minEvergreenScore || 70,
      maxItems = 50,
      platforms = null
    } = options;

    // Get all content for this client
    const contentQuery = { workspaceId: queue.clientWorkspaceId };
    if (platforms && platforms.length > 0) {
      // This would need to be adjusted based on how content is linked to platforms
    }

    const allContent = await Content.find(contentQuery).lean();

    // Detect evergreen content
    const evergreenContent = [];
    for (const content of allContent) {
      try {
        const score = await detectEvergreenContent(content, {
          minScore,
          platform: queue.platform === 'all' ? null : queue.platform,
          userId: queue.createdBy
        });

        if (score >= minScore) {
          // Get performance data
          const posts = await ScheduledPost.find({
            contentId: content._id,
            workspaceId: queue.clientWorkspaceId
          }).lean();

          const performance = calculatePerformance(posts);

          evergreenContent.push({
            contentId: content._id,
            evergreenScore: score,
            performance,
            content
          });
        }
      } catch (error) {
        logger.warn('Error detecting evergreen content', { contentId: content._id, error: error.message });
      }
    }

    // Sort by evergreen score and performance
    evergreenContent.sort((a, b) => {
      const scoreA = a.evergreenScore * 0.6 + (a.performance.averageEngagement || 0) * 0.4;
      const scoreB = b.evergreenScore * 0.6 + (b.performance.averageEngagement || 0) * 0.4;
      return scoreB - scoreA;
    });

    // Add top items to queue
    const itemsToAdd = evergreenContent.slice(0, maxItems).map(item => ({
      contentId: item.contentId,
      evergreenScore: item.evergreenScore,
      useCount: 0,
      status: 'active',
      performance: item.performance,
      nextScheduledDate: calculateNextScheduleDate(queue.settings.rotationFrequency)
    }));

    // Merge with existing items (avoid duplicates)
    const existingContentIds = new Set(queue.contentItems.map(item => item.contentId.toString()));
    const newItems = itemsToAdd.filter(item => !existingContentIds.has(item.contentId.toString()));

    queue.contentItems.push(...newItems);
    await queue.save();

    logger.info('Evergreen queue populated', { queueId, added: newItems.length });
    return {
      queue,
      added: newItems.length,
      total: queue.contentItems.length
    };
  } catch (error) {
    logger.error('Error populating evergreen queue', { error: error.message, queueId });
    throw error;
  }
}

/**
 * Calculate performance metrics
 */
function calculatePerformance(posts) {
  if (posts.length === 0) {
    return {
      averageEngagement: 0,
      averageReach: 0,
      lastEngagement: 0,
      trend: 'stable'
    };
  }

  const engagements = posts
    .filter(p => p.analytics?.engagement)
    .map(p => p.analytics.engagement);
  const reaches = posts
    .filter(p => p.analytics?.reach)
    .map(p => p.analytics.reach);

  const averageEngagement = engagements.length > 0
    ? engagements.reduce((sum, e) => sum + e, 0) / engagements.length
    : 0;
  const averageReach = reaches.length > 0
    ? reaches.reduce((sum, r) => sum + r, 0) / reaches.length
    : 0;

  // Determine trend
  let trend = 'stable';
  if (engagements.length >= 3) {
    const recent = engagements.slice(-3);
    const older = engagements.slice(0, -3);
    if (older.length > 0) {
      const recentAvg = recent.reduce((sum, e) => sum + e, 0) / recent.length;
      const olderAvg = older.reduce((sum, e) => sum + e, 0) / older.length;
      if (recentAvg > olderAvg * 1.1) trend = 'increasing';
      else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
    }
  }

  return {
    averageEngagement: Math.round(averageEngagement),
    averageReach: Math.round(averageReach),
    lastEngagement: engagements.length > 0 ? engagements[engagements.length - 1] : 0,
    trend
  };
}

/**
 * Calculate next schedule date
 */
function calculateNextScheduleDate(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'biweekly':
      now.setDate(now.getDate() + 14);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setDate(now.getDate() + 7);
  }
  return now;
}

/**
 * Auto-schedule next items from queue
 */
async function autoScheduleFromQueue(queueId, options = {}) {
  try {
    const queue = await EvergreenQueue.findById(queueId);
    if (!queue || !queue.isActive) {
      throw new Error('Queue not found or inactive');
    }

    if (!queue.settings.autoSchedule) {
      return { scheduled: 0, message: 'Auto-schedule disabled' };
    }

    const now = new Date();
    const itemsToSchedule = queue.contentItems
      .filter(item => 
        item.status === 'active' &&
        item.useCount < queue.settings.maxUsesPerItem &&
        (!item.nextScheduledDate || item.nextScheduledDate <= now)
      )
      .sort((a, b) => {
        // Sort by next scheduled date, then by evergreen score
        if (a.nextScheduledDate && b.nextScheduledDate) {
          return a.nextScheduledDate - b.nextScheduledDate;
        }
        return b.evergreenScore - a.evergreenScore;
      })
      .slice(0, options.maxItems || 5);

    const scheduled = [];
    const errors = [];

    for (const item of itemsToSchedule) {
      try {
        const content = await Content.findById(item.contentId);
        if (!content) {
          item.status = 'archived';
          continue;
        }

        // Create scheduled post
        const scheduledPost = new ScheduledPost({
          contentId: item.contentId,
          userId: queue.createdBy,
          workspaceId: queue.clientWorkspaceId,
          platform: queue.platform === 'all' ? content.platform || 'linkedin' : queue.platform,
          content: content.content,
          scheduledTime: calculateOptimalTime(queue.platform === 'all' ? content.platform : queue.platform),
          status: 'pending',
          metadata: {
            fromEvergreenQueue: true,
            queueId: queue._id,
            useCount: item.useCount + 1
          }
        });

        await scheduledPost.save();

        // Update queue item
        item.useCount++;
        item.lastUsed = new Date();
        item.nextScheduledDate = calculateNextScheduleDate(queue.settings.rotationFrequency);
        item.scheduledPostId = scheduledPost._id;

        // Check if item should be paused
        if (item.useCount >= queue.settings.maxUsesPerItem) {
          item.status = 'exhausted';
        }

        scheduled.push(scheduledPost);
      } catch (error) {
        errors.push({
          contentId: item.contentId,
          error: error.message
        });
        logger.warn('Error scheduling from evergreen queue', { itemId: item.contentId, error: error.message });
      }
    }

    queue.stats.totalPosts += scheduled.length;
    await queue.save();

    logger.info('Auto-scheduled from evergreen queue', { queueId, scheduled: scheduled.length, errors: errors.length });
    return {
      scheduled: scheduled.length,
      posts: scheduled,
      errors
    };
  } catch (error) {
    logger.error('Error auto-scheduling from queue', { error: error.message, queueId });
    throw error;
  }
}

/**
 * Calculate optimal posting time
 */
function calculateOptimalTime(platform) {
  // This would use the optimal time prediction service
  // For now, return tomorrow at 10 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow;
}

/**
 * Refresh queue items (update evergreen scores, performance)
 */
async function refreshEvergreenQueue(queueId) {
  try {
    const queue = await EvergreenQueue.findById(queueId);
    if (!queue) {
      throw new Error('Queue not found');
    }

    let updated = 0;
    let archived = 0;

    for (const item of queue.contentItems) {
      try {
        const content = await Content.findById(item.contentId);
        if (!content) {
          item.status = 'archived';
          archived++;
          continue;
        }

        // Recalculate evergreen score
        const newScore = await detectEvergreenContent(content, {
          minScore: 0,
          platform: queue.platform === 'all' ? null : queue.platform,
          userId: queue.createdBy
        });
        item.evergreenScore = newScore;

        // Update performance
        const posts = await ScheduledPost.find({
          contentId: item.contentId,
          workspaceId: queue.clientWorkspaceId
        }).lean();

        item.performance = calculatePerformance(posts);

        // Check if item should be refreshed or archived
        if (newScore < queue.settings.minEvergreenScore) {
          item.status = 'archived';
          archived++;
        } else if (item.performance.trend === 'decreasing' && 
                   item.performance.averageEngagement < (item.performance.averageEngagement * (1 - queue.settings.refreshThreshold))) {
          // Performance dropped significantly, mark for refresh
          item.status = 'paused';
        }

        updated++;
      } catch (error) {
        logger.warn('Error refreshing queue item', { itemId: item.contentId, error: error.message });
      }
    }

    await queue.save();

    logger.info('Evergreen queue refreshed', { queueId, updated, archived });
    return {
      updated,
      archived,
      total: queue.contentItems.length
    };
  } catch (error) {
    logger.error('Error refreshing evergreen queue', { error: error.message, queueId });
    throw error;
  }
}

/**
 * Get client evergreen queues
 */
async function getClientEvergreenQueues(clientWorkspaceId, filters = {}) {
  try {
    const { platform = null, isActive = null } = filters;

    const query = { clientWorkspaceId };
    if (platform) query.platform = platform;
    if (isActive !== null) query.isActive = isActive;

    const queues = await EvergreenQueue.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return queues;
  } catch (error) {
    logger.error('Error getting client evergreen queues', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  createEvergreenQueue,
  populateEvergreenQueue,
  autoScheduleFromQueue,
  refreshEvergreenQueue,
  getClientEvergreenQueues
};


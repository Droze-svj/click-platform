// Auto-Repost Scheduler
// Background job to automatically schedule reposts

const ContentRecycle = require('../models/ContentRecycle');
const { scheduleNextRepost } = require('./contentRecyclingService');
const logger = require('../utils/logger');

/**
 * Process pending reposts
 * Should be called by a cron job or scheduled task
 */
async function processPendingReposts() {
  try {
    const now = new Date();
    
    // Find recycling plans that need reposting
    const pendingRecycles = await ContentRecycle.find({
      status: 'active',
      'repostSchedule.isActive': true,
      'repostSchedule.nextRepostDate': { $lte: now },
      $expr: {
        $lt: ['$repostSchedule.currentRepostCount', '$repostSchedule.maxReposts']
      }
    }).lean();

    logger.info('Processing pending reposts', { count: pendingRecycles.length });

    const results = {
      scheduled: 0,
      failed: 0,
      completed: 0
    };

    for (const recycle of pendingRecycles) {
      try {
        const post = await scheduleNextRepost(recycle._id);
        if (post) {
          results.scheduled++;
          logger.info('Repost scheduled', { recycleId: recycle._id, postId: post._id });
        } else {
          results.completed++;
          logger.info('Recycling plan completed', { recycleId: recycle._id });
        }
      } catch (error) {
        results.failed++;
        logger.error('Error scheduling repost', { 
          error: error.message, 
          recycleId: recycle._id 
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error processing pending reposts', { error: error.message });
    throw error;
  }
}

/**
 * Update repost performance from posted content
 * Should be called after posts are published
 */
async function updateRepostPerformanceFromPost(postId) {
  try {
    const ScheduledPost = require('../models/ScheduledPost');
    const post = await ScheduledPost.findById(postId).lean();

    if (!post || !post.content?.isRecycled) {
      return null;
    }

    const originalPostId = post.content.originalPostId;
    if (!originalPostId) {
      return null;
    }

    // Find recycling plan
    const recycle = await ContentRecycle.findOne({
      originalPostId,
      status: 'active'
    });

    if (!recycle) {
      return null;
    }

    // Update performance
    const performance = {
      engagement: post.analytics?.engagement || 0,
      views: post.analytics?.views || post.analytics?.impressions || 0,
      clicks: post.analytics?.clicks || 0,
      impressions: post.analytics?.impressions || post.analytics?.views || 0,
      engagementRate: post.analytics?.engagementRate || 0
    };

    await updateRepostPerformance(recycle._id, postId, performance);
    
    logger.info('Repost performance updated from post', { recycleId: recycle._id, postId });
    return recycle;
  } catch (error) {
    logger.error('Error updating repost performance from post', { error: error.message, postId });
    return null;
  }
}

// Import updateRepostPerformance
const { updateRepostPerformance } = require('./contentRecyclingService');

module.exports = {
  processPendingReposts,
  updateRepostPerformanceFromPost
};



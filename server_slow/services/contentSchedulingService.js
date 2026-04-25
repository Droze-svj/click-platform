// Advanced content scheduling service

const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const { getOptimalPostingTimes } = require('./socialMediaService');
const logger = require('../utils/logger');

/**
 * Schedule content with optimal timing
 */
async function scheduleWithOptimalTiming(userId, contentId, platform, options = {}) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    // Get optimal posting times
    const optimalTimes = await getOptimalPostingTimes(userId, platform);
    
    // Select best time (or use provided time)
    const scheduledTime = options.scheduledTime || getNextOptimalTime(optimalTimes);

    const scheduledPost = new ScheduledPost({
      userId,
      contentId,
      platform,
      content: {
        text: content.title || content.description,
        mediaUrl: content.mediaUrl,
        hashtags: content.tags || []
      },
      scheduledTime: new Date(scheduledTime),
      status: 'scheduled',
      optimalTime: true
    });

    await scheduledPost.save();
    logger.info('Content scheduled with optimal timing', { userId, contentId, platform, scheduledTime });
    return scheduledPost;
  } catch (error) {
    logger.error('Error scheduling content', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Get next optimal time
 */
function getNextOptimalTime(optimalTimes) {
  if (optimalTimes.length === 0) {
    // Default: tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find next optimal time today
  for (const time of optimalTimes) {
    const optimalDate = new Date(today);
    optimalDate.setHours(time.hour, 0, 0, 0);
    
    if (optimalDate > now) {
      return optimalDate;
    }
  }

  // If no time today, use first optimal time tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(optimalTimes[0].hour, 0, 0, 0);
  return tomorrow;
}

/**
 * Bulk schedule content
 */
async function bulkSchedule(userId, contentIds, platform, scheduleOptions = {}) {
  try {
    const scheduledPosts = [];

    for (let i = 0; i < contentIds.length; i++) {
      const contentId = contentIds[i];
      const delay = scheduleOptions.delayBetweenPosts || 24; // hours
      const scheduledTime = new Date();
      scheduledTime.setHours(scheduledTime.getHours() + (i * delay));

      const scheduledPost = await scheduleWithOptimalTiming(
        userId,
        contentId,
        platform,
        { scheduledTime }
      );

      scheduledPosts.push(scheduledPost);
    }

    logger.info('Bulk scheduling completed', { userId, count: scheduledPosts.length });
    return scheduledPosts;
  } catch (error) {
    logger.error('Error in bulk scheduling', { error: error.message, userId });
    throw error;
  }
}

/**
 * Reschedule post
 */
async function reschedulePost(userId, postId, newTime) {
  try {
    const post = await ScheduledPost.findOne({
      _id: postId,
      userId
    });

    if (!post) {
      throw new Error('Post not found');
    }

    post.scheduledTime = new Date(newTime);
    post.status = 'scheduled';
    await post.save();

    logger.info('Post rescheduled', { userId, postId, newTime });
    return post;
  } catch (error) {
    logger.error('Error rescheduling post', { error: error.message, userId, postId });
    throw error;
  }
}

/**
 * Get content calendar
 */
async function getContentCalendar(userId, startDate, endDate) {
  try {
    const posts = await ScheduledPost.find({
      userId,
      scheduledTime: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('contentId', 'title type')
      .sort({ scheduledTime: 1 })
      .lean();

    // Group by date
    const calendar = {};
    posts.forEach(post => {
      const date = new Date(post.scheduledTime).toISOString().split('T')[0];
      if (!calendar[date]) {
        calendar[date] = [];
      }
      calendar[date].push(post);
    });

    return calendar;
  } catch (error) {
    logger.error('Error getting content calendar', { error: error.message, userId });
    throw error;
  }
}

/**
 * Detect content gaps
 */
async function detectContentGaps(userId, startDate, endDate) {
  try {
    const calendar = await getContentCalendar(userId, startDate, endDate);
    const gaps = [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (!calendar[dateStr] || calendar[dateStr].length === 0) {
        gaps.push({
          date: dateStr,
          dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'long' }),
          recommendation: 'No content scheduled'
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return gaps;
  } catch (error) {
    logger.error('Error detecting content gaps', { error: error.message, userId });
    return [];
  }
}

module.exports = {
  scheduleWithOptimalTiming,
  bulkSchedule,
  reschedulePost,
  getContentCalendar,
  detectContentGaps
};








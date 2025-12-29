// Content Calendar Service

const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Get content calendar
 */
async function getContentCalendar(userId, options = {}) {
  try {
    const {
      startDate = new Date(),
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      platforms = null,
    } = options;

    // Get scheduled posts
    const scheduledPosts = await ScheduledPost.find({
      userId,
      scheduledTime: {
        $gte: startDate,
        $lte: endDate,
      },
      ...(platforms && { platform: { $in: platforms } }),
    })
      .populate('contentId', 'title body status')
      .sort({ scheduledTime: 1 })
      .lean();

    // Get optimal posting times
    const optimalTimes = await getOptimalPostingTimes(userId, platforms);

    // Group by date
    const calendar = {};
    scheduledPosts.forEach(post => {
      const date = new Date(post.scheduledTime).toISOString().split('T')[0];
      if (!calendar[date]) {
        calendar[date] = [];
      }
      calendar[date].push({
        id: post._id,
        contentId: post.contentId?._id,
        title: post.contentId?.title,
        platform: post.platform,
        scheduledTime: post.scheduledTime,
        status: post.status,
      });
    });

    return {
      calendar,
      optimalTimes,
      totalScheduled: scheduledPosts.length,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    };
  } catch (error) {
    logger.error('Get content calendar error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get optimal posting times
 */
async function getOptimalPostingTimes(userId, platforms = null) {
  try {
    const Content = require('../models/Content');
    
    // Analyze past performance to find best times
    const publishedContent = await Content.find({
      userId,
      status: 'published',
      publishedAt: { $exists: true },
    })
      .select('publishedAt platform views likes shares')
      .lean();

    if (publishedContent.length === 0) {
      // Return default optimal times
      return {
        instagram: ['09:00', '13:00', '17:00'],
        twitter: ['08:00', '12:00', '16:00', '20:00'],
        linkedin: ['08:00', '12:00', '17:00'],
        facebook: ['09:00', '13:00', '18:00'],
      };
    }

    // Group by platform and hour
    const performanceByHour = {};
    
    publishedContent.forEach(content => {
      if (!content.publishedAt) return;
      
      const platform = content.platform || 'general';
      const hour = new Date(content.publishedAt).getHours();
      const performance = (content.views || 0) + (content.likes || 0) * 10 + (content.shares || 0) * 20;

      if (!performanceByHour[platform]) {
        performanceByHour[platform] = {};
      }

      if (!performanceByHour[platform][hour]) {
        performanceByHour[platform][hour] = { total: 0, count: 0 };
      }

      performanceByHour[platform][hour].total += performance;
      performanceByHour[platform][hour].count += 1;
    });

    // Calculate average performance per hour
    const optimalTimes = {};
    
    Object.keys(performanceByHour).forEach(platform => {
      const hours = Object.entries(performanceByHour[platform])
        .map(([hour, data]) => ({
          hour: parseInt(hour),
          avgPerformance: data.total / data.count,
        }))
        .sort((a, b) => b.avgPerformance - a.avgPerformance)
        .slice(0, 3)
        .map(item => `${String(item.hour).padStart(2, '0')}:00`);

      optimalTimes[platform] = hours;
    });

    return optimalTimes;
  } catch (error) {
    logger.error('Get optimal posting times error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Suggest calendar gaps
 */
async function suggestCalendarGaps(userId, options = {}) {
  try {
    const {
      startDate = new Date(),
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      platforms = ['instagram', 'twitter', 'linkedin'],
      minPostsPerWeek = 3,
    } = options;

    const calendar = await getContentCalendar(userId, { startDate, endDate, platforms });

    const gaps = [];
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // Check each day
    for (let i = 0; i < daysDiff; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const dayPosts = calendar.calendar[dateStr] || [];
      const postsByPlatform = {};

      dayPosts.forEach(post => {
        if (!postsByPlatform[post.platform]) {
          postsByPlatform[post.platform] = 0;
        }
        postsByPlatform[post.platform]++;
      });

      for (const platform of platforms) {
        if (!postsByPlatform[platform] || postsByPlatform[platform] < 1) {
          gaps.push({
            date: dateStr,
            platform,
            dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
            suggestedTime: await getOptimalTimeForDate(userId, platform, date),
          });
        }
      }
    }

    return {
      gaps,
      totalGaps: gaps.length,
      recommendation: gaps.length > 0
        ? `Consider scheduling ${gaps.length} more posts to fill calendar gaps`
        : 'Your calendar is well-filled',
    };
  } catch (error) {
    logger.error('Suggest calendar gaps error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get optimal time for specific date
 */
async function getOptimalTimeForDate(userId, platform, date) {
  try {
    const optimalTimes = await getOptimalPostingTimes(userId, [platform]);
    const platformTimes = optimalTimes[platform] || optimalTimes.instagram || ['09:00'];
    
    // Return first optimal time
    return platformTimes[0];
  } catch (error) {
    return '09:00'; // Default
  }
}

/**
 * Bulk schedule content
 */
async function bulkScheduleContent(userId, scheduleData) {
  try {
    const { contentIds, startDate, platforms, frequency = 'daily' } = scheduleData;

    if (!contentIds || contentIds.length === 0) {
      throw new Error('Content IDs required');
    }

    const schedules = [];
    let currentDate = new Date(startDate);
    const optimalTimes = await getOptimalPostingTimes(userId, platforms);

    contentIds.forEach((contentId, index) => {
      platforms.forEach(platform => {
        const optimalTime = optimalTimes[platform]?.[0] || '09:00';
        const [hour, minute] = optimalTime.split(':').map(Number);

        const scheduledTime = new Date(currentDate);
        scheduledTime.setHours(hour, minute, 0, 0);

        schedules.push({
          userId,
          contentId,
          platform,
          scheduledTime,
          status: 'pending',
        });

        // Increment date based on frequency
        if (frequency === 'daily') {
          currentDate.setDate(currentDate.getDate() + 1);
        } else if (frequency === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        }
      });
    });

    const created = await ScheduledPost.insertMany(schedules);

    logger.info('Bulk content scheduled', {
      userId,
      count: created.length,
      platforms: platforms.length,
    });

    return {
      success: true,
      scheduled: created.length,
      schedules: created.map(s => ({
        id: s._id,
        contentId: s.contentId,
        platform: s.platform,
        scheduledTime: s.scheduledTime,
      })),
    };
  } catch (error) {
    logger.error('Bulk schedule content error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getContentCalendar,
  getOptimalPostingTimes,
  suggestCalendarGaps,
  bulkScheduleContent,
};







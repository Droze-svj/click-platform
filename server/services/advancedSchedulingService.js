// Advanced Scheduling Service
// Enhanced scheduling with time zones, recurring schedules, templates, and optimization

const ScheduledPost = require('../models/ScheduledPost');
const RecurringSchedule = require('../models/RecurringSchedule');
const ScheduleTemplate = require('../models/ScheduleTemplate');
const Content = require('../models/Content');
const logger = require('../utils/logger');
const { getOptimalPostingTimes } = require('./contentCalendarService');

/**
 * Schedule with time zone support
 */
async function scheduleWithTimezone(userId, contentId, platform, scheduledTime, timezone = 'UTC') {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    // Convert time to UTC if needed
    const utcTime = convertToUTC(scheduledTime, timezone);

    const scheduledPost = new ScheduledPost({
      userId,
      contentId,
      platform,
      content: {
        text: content.title || content.description,
        mediaUrl: content.mediaUrl,
        hashtags: content.tags || []
      },
      scheduledTime: utcTime,
      timezone,
      status: 'scheduled'
    });

    await scheduledPost.save();
    logger.info('Content scheduled with timezone', { userId, contentId, platform, timezone });
    return scheduledPost;
  } catch (error) {
    logger.error('Error scheduling with timezone', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Convert time to UTC
 */
function convertToUTC(time, timezone) {
  // Simple conversion - in production, use a library like moment-timezone or date-fns-tz
  const date = new Date(time);
  // For now, assume timezone is a valid IANA timezone
  // In production, use proper timezone conversion
  return date;
}

/**
 * Create recurring schedule
 */
async function createRecurringSchedule(userId, scheduleData) {
  try {
    const {
      name,
      description,
      contentId,
      platform,
      recurrence,
      schedule,
      autoRefresh
    } = scheduleData;

    // Calculate next scheduled date
    const nextDate = calculateNextRecurrence(recurrence, schedule.startDate);

    const recurringSchedule = new RecurringSchedule({
      userId,
      name,
      description,
      contentId,
      platform,
      recurrence,
      schedule: {
        ...schedule,
        nextScheduledDate: nextDate
      },
      autoRefresh: autoRefresh || { enabled: false }
    });

    await recurringSchedule.save();

    // Create first scheduled post
    await createScheduledPostFromRecurring(recurringSchedule);

    logger.info('Recurring schedule created', { userId, scheduleId: recurringSchedule._id });
    return recurringSchedule;
  } catch (error) {
    logger.error('Error creating recurring schedule', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate next recurrence date
 */
function calculateNextRecurrence(recurrence, startDate) {
  const date = new Date(startDate);
  const now = new Date();

  switch (recurrence.frequency) {
    case 'daily':
      date.setDate(date.getDate() + recurrence.interval);
      break;
    case 'weekly':
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        // Find next matching day of week
        const currentDay = date.getDay();
        const nextDay = recurrence.daysOfWeek.find(day => day > currentDay) || recurrence.daysOfWeek[0];
        const daysToAdd = nextDay > currentDay ? nextDay - currentDay : 7 - currentDay + nextDay;
        date.setDate(date.getDate() + daysToAdd);
      } else {
        date.setDate(date.getDate() + (7 * recurrence.interval));
      }
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + recurrence.interval);
      if (recurrence.dayOfMonth) {
        date.setDate(recurrence.dayOfMonth);
      }
      break;
  }

  // Apply time if specified
  if (recurrence.times && recurrence.times.length > 0) {
    const [hour, minute] = recurrence.times[0].split(':').map(Number);
    date.setHours(hour, minute, 0, 0);
  }

  return date > now ? date : calculateNextRecurrence(recurrence, date);
}

/**
 * Create scheduled post from recurring schedule
 */
async function createScheduledPostFromRecurring(recurringSchedule) {
  try {
    const content = await Content.findById(recurringSchedule.contentId).lean();
    if (!content) {
      throw new Error('Content not found');
    }

    // Apply auto-refresh if enabled
    let postContent = {
      text: content.title || content.description,
      mediaUrl: content.mediaUrl,
      hashtags: content.tags || []
    };

    if (recurringSchedule.autoRefresh?.enabled) {
      if (recurringSchedule.autoRefresh.refreshOptions?.updateHashtags) {
        const { generateHashtags } = require('./hashtagService');
        try {
          const hashtags = await generateHashtags(content.title || '', { count: 5 });
          if (Array.isArray(hashtags)) {
            postContent.hashtags = hashtags.map(h => typeof h === 'string' ? h : h.tag || h.text).slice(0, 5);
          }
        } catch (error) {
          logger.warn('Error refreshing hashtags', { error: error.message });
        }
      }
    }

    const scheduledPost = new ScheduledPost({
      userId: recurringSchedule.userId,
      contentId: recurringSchedule.contentId,
      platform: recurringSchedule.platform,
      content: postContent,
      scheduledTime: recurringSchedule.schedule.nextScheduledDate,
      timezone: recurringSchedule.recurrence.timezone,
      status: 'scheduled',
      recurringScheduleId: recurringSchedule._id
    });

    await scheduledPost.save();
    return scheduledPost;
  } catch (error) {
    logger.error('Error creating scheduled post from recurring', { error: error.message });
    throw error;
  }
}

/**
 * Process recurring schedules
 */
async function processRecurringSchedules() {
  try {
    const now = new Date();
    
    const activeSchedules = await RecurringSchedule.find({
      status: 'active',
      'schedule.nextScheduledDate': { $lte: now },
      $or: [
        { 'schedule.endDate': { $exists: false } },
        { 'schedule.endDate': { $gte: now } }
      ]
    }).lean();

    const results = {
      processed: 0,
      created: 0,
      completed: 0,
      failed: 0
    };

    for (const schedule of activeSchedules) {
      try {
        // Check max occurrences
        if (schedule.schedule.maxOccurrences && 
            schedule.schedule.currentOccurrence >= schedule.schedule.maxOccurrences) {
          await RecurringSchedule.findByIdAndUpdate(schedule._id, { status: 'completed' });
          results.completed++;
          continue;
        }

        // Create scheduled post
        await createScheduledPostFromRecurring(schedule);

        // Update recurring schedule
        const nextDate = calculateNextRecurrence(schedule.recurrence, schedule.schedule.nextScheduledDate);
        
        await RecurringSchedule.findByIdAndUpdate(schedule._id, {
          'schedule.nextScheduledDate': nextDate,
          $inc: { 'schedule.currentOccurrence': 1 }
        });

        results.processed++;
        results.created++;
      } catch (error) {
        logger.error('Error processing recurring schedule', { 
          error: error.message, 
          scheduleId: schedule._id 
        });
        results.failed++;
      }
    }

    logger.info('Recurring schedules processed', results);
    return results;
  } catch (error) {
    logger.error('Error processing recurring schedules', { error: error.message });
    throw error;
  }
}

/**
 * Detect scheduling conflicts
 */
async function detectConflicts(userId, scheduledTime, platform, excludePostId = null) {
  try {
    const conflictWindow = 2 * 60 * 60 * 1000; // 2 hours
    const windowStart = new Date(scheduledTime.getTime() - conflictWindow);
    const windowEnd = new Date(scheduledTime.getTime() + conflictWindow);

    const query = {
      userId,
      platform,
      status: { $in: ['scheduled', 'pending'] },
      scheduledTime: { $gte: windowStart, $lte: windowEnd }
    };

    if (excludePostId) {
      query._id = { $ne: excludePostId };
    }

    const conflicts = await ScheduledPost.find(query).lean();

    return {
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts: conflicts.map(c => ({
        postId: c._id,
        scheduledTime: c.scheduledTime,
        timeDifference: Math.round((Math.abs(c.scheduledTime - scheduledTime) / (1000 * 60))),
        contentId: c.contentId
      }))
    };
  } catch (error) {
    logger.error('Error detecting conflicts', { error: error.message, userId });
    throw error;
  }
}

/**
 * Resolve scheduling conflicts
 */
async function resolveConflicts(userId, postId, strategy = 'auto') {
  try {
    const post = await ScheduledPost.findById(postId);
    if (!post || post.userId.toString() !== userId.toString()) {
      throw new Error('Post not found');
    }

    const conflicts = await detectConflicts(userId, post.scheduledTime, post.platform, postId);

    if (!conflicts.hasConflicts) {
      return { resolved: false, message: 'No conflicts found' };
    }

    let newTime = post.scheduledTime;

    switch (strategy) {
      case 'auto':
        // Find next available slot
        const { getOptimalPostingTimes } = require('./contentCalendarService');
        const optimalTimes = await getOptimalPostingTimes(userId, [post.platform]);
        
        // Try next optimal time
        newTime = new Date(post.scheduledTime);
        newTime.setHours(newTime.getHours() + 2); // Move 2 hours forward
        
        // Check if still conflicts
        let attempts = 0;
        while (attempts < 10) {
          const newConflicts = await detectConflicts(userId, newTime, post.platform, postId);
          if (!newConflicts.hasConflicts) {
            break;
          }
          newTime.setHours(newTime.getHours() + 1);
          attempts++;
        }
        break;

      case 'delay':
        newTime = new Date(post.scheduledTime);
        newTime.setHours(newTime.getHours() + 2);
        break;

      case 'advance':
        newTime = new Date(post.scheduledTime);
        newTime.setHours(newTime.getHours() - 2);
        break;
    }

    post.scheduledTime = newTime;
    post.conflictResolved = true;
    await post.save();

    return {
      resolved: true,
      newTime,
      conflictsResolved: conflicts.conflictCount
    };
  } catch (error) {
    logger.error('Error resolving conflicts', { error: error.message, postId });
    throw error;
  }
}

/**
 * Create schedule template
 */
async function createScheduleTemplate(userId, templateData) {
  try {
    const template = new ScheduleTemplate({
      userId,
      ...templateData
    });

    // If set as default, unset other defaults
    if (template.isDefault) {
      await ScheduleTemplate.updateMany(
        { userId, _id: { $ne: template._id } },
        { isDefault: false }
      );
    }

    await template.save();
    logger.info('Schedule template created', { userId, templateId: template._id });
    return template;
  } catch (error) {
    logger.error('Error creating schedule template', { error: error.message, userId });
    throw error;
  }
}

/**
 * Apply schedule template
 */
async function applyScheduleTemplate(userId, contentIds, templateId, options = {}) {
  try {
    const template = await ScheduleTemplate.findOne({
      _id: templateId,
      userId
    });

    if (!template) {
      throw new Error('Template not found');
    }

    const { startDate = new Date() } = options;
    const schedules = [];
    let currentDate = new Date(startDate);

    // Filter content by template rules
    const contentQuery = { _id: { $in: contentIds }, userId };
    if (template.contentRules.contentType?.length > 0) {
      contentQuery.type = { $in: template.contentRules.contentType };
    }
    if (template.contentRules.categories?.length > 0) {
      contentQuery.category = { $in: template.contentRules.categories };
    }

    const content = await Content.find(contentQuery).lean();

    for (const item of content) {
      for (const platform of template.platforms) {
        // Get times for this platform
        const times = template.optimization.preferredTimes?.get(platform) || 
                     template.scheduleConfig.times || 
                     ['09:00'];

        for (const time of times) {
          const [hour, minute] = time.split(':').map(Number);
          const scheduledTime = new Date(currentDate);
          scheduledTime.setHours(hour, minute, 0, 0);

          // Check conflicts
          const conflicts = await detectConflicts(userId, scheduledTime, platform);
          if (conflicts.hasConflicts && !options.allowConflicts) {
            // Skip or resolve
            continue;
          }

          schedules.push({
            userId,
            contentId: item._id,
            platform,
            scheduledTime,
            timezone: template.scheduleConfig.timezone,
            status: 'scheduled',
            templateId: template._id
          });

          // Increment date based on frequency
          if (template.scheduleConfig.frequency === 'daily') {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (template.scheduleConfig.frequency === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          }
        }
      }
    }

    const created = await ScheduledPost.insertMany(schedules);

    // Update template usage
    await ScheduleTemplate.findByIdAndUpdate(templateId, {
      $inc: { usageCount: 1 }
    });

    logger.info('Schedule template applied', { userId, templateId, schedulesCreated: created.length });
    return {
      success: true,
      schedulesCreated: created.length,
      schedules: created
    };
  } catch (error) {
    logger.error('Error applying schedule template', { error: error.message, userId, templateId });
    throw error;
  }
}

/**
 * Optimize schedule
 */
async function optimizeSchedule(userId, dateRange = 7) {
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dateRange);

    const posts = await ScheduledPost.find({
      userId,
      status: { $in: ['scheduled', 'pending'] },
      scheduledTime: { $gte: startDate, $lte: endDate }
    }).lean();

    // Get optimal times
    const platforms = [...new Set(posts.map(p => p.platform))];
    const optimalTimes = await getOptimalPostingTimes(userId, platforms);

    const optimizations = [];
    let optimizedCount = 0;

    for (const post of posts) {
      const platformOptimal = optimalTimes[post.platform] || [];
      if (platformOptimal.length === 0) continue;

      const currentHour = new Date(post.scheduledTime).getHours();
      const optimalHour = parseInt(platformOptimal[0].split(':')[0]);

      // If not at optimal time, suggest change
      if (Math.abs(currentHour - optimalHour) > 1) {
        const optimizedTime = new Date(post.scheduledTime);
        optimizedTime.setHours(optimalHour, 0, 0, 0);

        optimizations.push({
          postId: post._id,
          currentTime: post.scheduledTime,
          optimizedTime,
          platform: post.platform,
          score: calculateOptimizationScore(post, optimizedTime, optimalTimes[post.platform])
        });
      }
    }

    return {
      totalPosts: posts.length,
      optimizations,
      optimizedCount: optimizations.length
    };
  } catch (error) {
    logger.error('Error optimizing schedule', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate optimization score
 */
function calculateOptimizationScore(post, optimizedTime, optimalTimes) {
  let score = 50; // Base score

  const optimizedHour = optimizedTime.getHours();
  const optimalHour = parseInt(optimalTimes[0].split(':')[0]);

  // Closer to optimal = higher score
  const hourDiff = Math.abs(optimizedHour - optimalHour);
  score += (3 - hourDiff) * 10; // Max 30 points for perfect timing

  // Check if in optimal time window
  if (optimalTimes.some(time => {
    const hour = parseInt(time.split(':')[0]);
    return Math.abs(optimizedHour - hour) <= 1;
  })) {
    score += 20;
  }

  return Math.min(100, score);
}

/**
 * Get schedule analytics
 */
async function getScheduleAnalytics(userId, period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const posts = await ScheduledPost.find({
      userId,
      scheduledTime: { $gte: startDate }
    }).lean();

    const analytics = {
      totalScheduled: posts.length,
      byStatus: {},
      byPlatform: {},
      byDayOfWeek: {},
      byHour: {},
      averagePostsPerDay: 0,
      optimalTimeUsage: 0,
      conflictRate: 0
    };

    posts.forEach(post => {
      // Status breakdown
      analytics.byStatus[post.status] = (analytics.byStatus[post.status] || 0) + 1;

      // Platform breakdown
      analytics.byPlatform[post.platform] = (analytics.byPlatform[post.platform] || 0) + 1;

      // Day of week
      const day = new Date(post.scheduledTime).toLocaleDateString('en-US', { weekday: 'long' });
      analytics.byDayOfWeek[day] = (analytics.byDayOfWeek[day] || 0) + 1;

      // Hour
      const hour = new Date(post.scheduledTime).getHours();
      analytics.byHour[hour] = (analytics.byHour[hour] || 0) + 1;

      // Optimal time usage
      if (post.optimizationScore > 70) {
        analytics.optimalTimeUsage++;
      }

      // Conflict rate
      if (post.conflictResolved) {
        analytics.conflictRate++;
      }
    });

    analytics.averagePostsPerDay = period > 0 ? (analytics.totalScheduled / period) : 0;
    analytics.optimalTimeUsage = analytics.totalScheduled > 0 
      ? (analytics.optimalTimeUsage / analytics.totalScheduled) * 100 
      : 0;
    analytics.conflictRate = analytics.totalScheduled > 0
      ? (analytics.conflictRate / analytics.totalScheduled) * 100
      : 0;

    return analytics;
  } catch (error) {
    logger.error('Error getting schedule analytics', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  scheduleWithTimezone,
  createRecurringSchedule,
  processRecurringSchedules,
  detectConflicts,
  resolveConflicts,
  createScheduleTemplate,
  applyScheduleTemplate,
  optimizeSchedule,
  getScheduleAnalytics
};



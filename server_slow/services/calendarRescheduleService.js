// Calendar Reschedule Service
// Drag-and-drop and bulk rescheduling

const ScheduledPost = require('../models/ScheduledPost');
const { handlePostRescheduled, handleBulkReschedule } = require('./calendarRealtimeService');
const { getCalendarConflicts } = require('./masterCalendarService');
const { getOptimalPostingTimes } = require('./smartScheduleOptimizationService');
const logger = require('../utils/logger');

/**
 * Reschedule single post (drag-and-drop)
 */
async function reschedulePost(postId, newScheduledTime, options = {}) {
  try {
    const {
      checkConflicts = true,
      autoResolveConflicts = false,
      notifyTeam = true
    } = options;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const oldTime = post.scheduledTime;
    const newTime = new Date(newScheduledTime);

    // Check for conflicts
    if (checkConflicts) {
      const conflicts = await checkPostConflicts(post, newTime);
      if (conflicts.length > 0 && !autoResolveConflicts) {
        return {
          success: false,
          conflicts,
          message: 'Scheduling conflicts detected'
        };
      }

      // Auto-resolve if enabled
      if (conflicts.length > 0 && autoResolveConflicts) {
        await resolveConflicts(conflicts, post);
      }
    }

    // Update post
    post.scheduledTime = newTime;
    post.conflictResolved = false;
    await post.save();

    // Emit real-time update
    await handlePostRescheduled(post, oldTime, newTime);

    logger.info('Post rescheduled', { postId, oldTime, newTime });

    return {
      success: true,
      post,
      oldTime,
      newTime
    };
  } catch (error) {
    logger.error('Error rescheduling post', { error: error.message, postId });
    throw error;
  }
}

/**
 * Bulk reschedule posts
 */
async function bulkReschedule(agencyWorkspaceId, rescheduleData, options = {}) {
  try {
    const {
      postIds,
      newTimes, // Array of { postId, newTime } or { date, time, timezone }
      strategy = 'individual', // 'individual', 'shift', 'optimal'
      checkConflicts = true
    } = rescheduleData;

    const {
      autoResolveConflicts = false,
      notifyTeam = true
    } = options;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      throw new Error('Post IDs are required');
    }

    const results = {
      total: postIds.length,
      successful: 0,
      failed: 0,
      results: []
    };

    // Get posts
    const posts = await ScheduledPost.find({
      _id: { $in: postIds },
      agencyWorkspaceId
    });

    if (posts.length !== postIds.length) {
      throw new Error('Some posts not found');
    }

    // Apply rescheduling strategy
    let newScheduledTimes = [];

    if (strategy === 'shift') {
      // Shift all posts by a time delta
      const { deltaHours, deltaDays } = rescheduleData;
      const deltaMs = (deltaDays || 0) * 24 * 60 * 60 * 1000 + (deltaHours || 0) * 60 * 60 * 1000;

      newScheduledTimes = posts.map(post => ({
        postId: post._id,
        newTime: new Date(new Date(post.scheduledTime).getTime() + deltaMs)
      }));
    } else if (strategy === 'optimal') {
      // Reschedule to optimal times
      for (const post of posts) {
        try {
          const Workspace = require('../models/Workspace');
          const clientWorkspace = await Workspace.findById(post.clientWorkspaceId);
          if (!clientWorkspace) continue;

          const optimalTimes = await getOptimalPostingTimes(
            clientWorkspace.ownerId,
            post.platform,
            new Date(post.scheduledTime)
          );

          if (optimalTimes.length > 0) {
            const [hour, minute] = optimalTimes[0].split(':').map(Number);
            const newTime = new Date(post.scheduledTime);
            newTime.setHours(hour, minute, 0, 0);

            newScheduledTimes.push({
              postId: post._id,
              newTime
            });
          }
        } catch (error) {
          logger.warn('Error getting optimal time', { error: error.message, postId: post._id });
        }
      }
    } else {
      // Individual times provided
      newScheduledTimes = newTimes || posts.map((post, index) => ({
        postId: post._id,
        newTime: new Date(post.scheduledTime) // Default: no change
      }));
    }

    // Reschedule each post
    for (const { postId, newTime } of newScheduledTimes) {
      try {
        const post = posts.find(p => p._id.toString() === postId.toString());
        if (!post) {
          results.results.push({ postId, success: false, error: 'Post not found' });
          results.failed++;
          continue;
        }

        const result = await reschedulePost(postId, newTime, {
          checkConflicts,
          autoResolveConflicts,
          notifyTeam: false // Batch notify at end
        });

        if (result.success) {
          results.results.push({ postId, success: true, newTime });
          results.successful++;
        } else {
          results.results.push({ postId, success: false, error: result.message, conflicts: result.conflicts });
          results.failed++;
        }
      } catch (error) {
        logger.error('Error rescheduling post in bulk', { error: error.message, postId });
        results.results.push({ postId, success: false, error: error.message });
        results.failed++;
      }
    }

    // Emit bulk update
    await handleBulkReschedule(agencyWorkspaceId, results);

    logger.info('Bulk reschedule completed', { agencyWorkspaceId, ...results });

    return results;
  } catch (error) {
    logger.error('Error in bulk reschedule', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Check for conflicts with new time
 */
async function checkPostConflicts(post, newTime) {
  try {
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const startTime = new Date(newTime.getTime() - timeWindow);
    const endTime = new Date(newTime.getTime() + timeWindow);

    const conflicts = await ScheduledPost.find({
      _id: { $ne: post._id },
      clientWorkspaceId: post.clientWorkspaceId,
      platform: post.platform,
      scheduledTime: {
        $gte: startTime,
        $lte: endTime
      },
      status: { $in: ['scheduled', 'pending'] }
    }).lean();

    return conflicts.map(c => ({
      postId: c._id,
      scheduledTime: c.scheduledTime,
      conflictType: 'time_overlap'
    }));
  } catch (error) {
    logger.error('Error checking conflicts', { error: error.message });
    return [];
  }
}

/**
 * Resolve conflicts by adjusting times
 */
async function resolveConflicts(conflicts, originalPost) {
  for (const conflict of conflicts) {
    const conflictPost = await ScheduledPost.findById(conflict.postId);
    if (!conflictPost) continue;

    // Shift conflict post by 10 minutes
    const newTime = new Date(conflictPost.scheduledTime);
    newTime.setMinutes(newTime.getMinutes() + 10);

    conflictPost.scheduledTime = newTime;
    conflictPost.conflictResolved = true;
    await conflictPost.save();

    await handlePostRescheduled(conflictPost, conflict.scheduledTime, newTime);
  }
}

/**
 * Get reschedule suggestions
 */
async function getRescheduleSuggestions(postId, options = {}) {
  try {
    const {
      suggestOptimal = true,
      suggestAlternatives = true,
      maxSuggestions = 5
    } = options;

    const post = await ScheduledPost.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const suggestions = [];

    // Optimal time suggestions
    if (suggestOptimal) {
      try {
        const Workspace = require('../models/Workspace');
        const clientWorkspace = await Workspace.findById(post.clientWorkspaceId);
        if (clientWorkspace) {
          const optimalTimes = await getOptimalPostingTimes(
            clientWorkspace.ownerId,
            post.platform,
            new Date(post.scheduledTime)
          );

          optimalTimes.slice(0, maxSuggestions).forEach(time => {
            const [hour, minute] = time.split(':').map(Number);
            const suggestedTime = new Date(post.scheduledTime);
            suggestedTime.setHours(hour, minute, 0, 0);

            suggestions.push({
              time: suggestedTime,
              reason: 'optimal_posting_time',
              score: 100
            });
          });
        }
      } catch (error) {
        logger.warn('Error getting optimal times', { error: error.message });
      }
    }

    // Alternative time suggestions (avoid conflicts)
    if (suggestAlternatives) {
      const currentTime = new Date(post.scheduledTime);
      const alternatives = [
        { hours: -2, reason: '2_hours_earlier' },
        { hours: -1, reason: '1_hour_earlier' },
        { hours: 1, reason: '1_hour_later' },
        { hours: 2, reason: '2_hours_later' }
      ];

      for (const alt of alternatives) {
        const altTime = new Date(currentTime);
        altTime.setHours(altTime.getHours() + alt.hours);

        const conflicts = await checkPostConflicts(post, altTime);
        if (conflicts.length === 0) {
          suggestions.push({
            time: altTime,
            reason: alt.reason,
            score: 80
          });
        }
      }
    }

    // Sort by score
    suggestions.sort((a, b) => b.score - a.score);

    return suggestions.slice(0, maxSuggestions);
  } catch (error) {
    logger.error('Error getting reschedule suggestions', { error: error.message, postId });
    throw error;
  }
}

module.exports = {
  reschedulePost,
  bulkReschedule,
  getRescheduleSuggestions
};



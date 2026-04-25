// Calendar Real-time Service
// Real-time updates for calendar via WebSocket

const ScheduledPost = require('../models/ScheduledPost');
const CalendarEvent = require('../models/CalendarEvent');
const { getSocketService } = require('./socketService');
const logger = require('../utils/logger');

/**
 * Emit calendar update to agency workspace
 */
function emitCalendarUpdate(agencyWorkspaceId, update) {
  try {
    const io = getSocketService();
    if (!io) {
      logger.warn('Socket service not initialized');
      return;
    }

    io.to(`agency-calendar-${agencyWorkspaceId}`).emit('calendar:update', {
      type: update.type, // 'post_created', 'post_updated', 'post_deleted', 'post_rescheduled'
      data: update.data,
      timestamp: new Date()
    });

    logger.debug('Calendar update emitted', { agencyWorkspaceId, type: update.type });
  } catch (error) {
    logger.error('Error emitting calendar update', { error: error.message, agencyWorkspaceId });
  }
}

/**
 * Emit calendar conflict alert
 */
function emitCalendarConflict(agencyWorkspaceId, conflict) {
  try {
    const io = getSocketService();
    if (!io) return;

    io.to(`agency-calendar-${agencyWorkspaceId}`).emit('calendar:conflict', {
      conflict,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error emitting calendar conflict', { error: error.message });
  }
}

/**
 * Emit calendar analytics update
 */
function emitCalendarAnalytics(agencyWorkspaceId, analytics) {
  try {
    const io = getSocketService();
    if (!io) return;

    io.to(`agency-calendar-${agencyWorkspaceId}`).emit('calendar:analytics', {
      analytics,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error emitting calendar analytics', { error: error.message });
  }
}

/**
 * Handle post creation
 */
async function handlePostCreated(post) {
  if (post.agencyWorkspaceId) {
    emitCalendarUpdate(post.agencyWorkspaceId, {
      type: 'post_created',
      data: {
        postId: post._id,
        scheduledTime: post.scheduledTime,
        platform: post.platform,
        clientWorkspaceId: post.clientWorkspaceId,
        status: post.status
      }
    });
  }
}

/**
 * Handle post update
 */
async function handlePostUpdated(post, changes) {
  if (post.agencyWorkspaceId) {
    emitCalendarUpdate(post.agencyWorkspaceId, {
      type: 'post_updated',
      data: {
        postId: post._id,
        changes,
        scheduledTime: post.scheduledTime,
        platform: post.platform,
        clientWorkspaceId: post.clientWorkspaceId,
        status: post.status
      }
    });
  }
}

/**
 * Handle post deletion
 */
async function handlePostDeleted(postId, agencyWorkspaceId) {
  if (agencyWorkspaceId) {
    emitCalendarUpdate(agencyWorkspaceId, {
      type: 'post_deleted',
      data: {
        postId
      }
    });
  }
}

/**
 * Handle post rescheduling
 */
async function handlePostRescheduled(post, oldTime, newTime) {
  if (post.agencyWorkspaceId) {
    emitCalendarUpdate(post.agencyWorkspaceId, {
      type: 'post_rescheduled',
      data: {
        postId: post._id,
        oldTime,
        newTime,
        platform: post.platform,
        clientWorkspaceId: post.clientWorkspaceId
      }
    });
  }
}

/**
 * Handle bulk reschedule
 */
async function handleBulkReschedule(agencyWorkspaceId, results) {
  emitCalendarUpdate(agencyWorkspaceId, {
    type: 'bulk_reschedule',
    data: {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
      results: results.results
    }
  });
}

module.exports = {
  emitCalendarUpdate,
  emitCalendarConflict,
  emitCalendarAnalytics,
  handlePostCreated,
  handlePostUpdated,
  handlePostDeleted,
  handlePostRescheduled,
  handleBulkReschedule
};



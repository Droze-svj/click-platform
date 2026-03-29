// Real-time notification service — contextual, persistent, optional AI summary

const logger = require('../utils/logger');
const { getIO } = require('./socketService');
const Notification = require('../models/Notification');
const UserSettings = require('../models/UserSettings');

function normalizeUserId(userId) {
  return userId != null && typeof userId === 'object' && userId.toString
    ? userId.toString()
    : String(userId);
}

class NotificationService {
  constructor() {
    this.io = null;
  }

  initialize(io) {
    this.io = io;
    logger.info('Notification service initialized');
  }

  /**
   * Check user preferences: allow in-app notification for this category, channel, and priority tier.
   * If no settings or value not set, allow (default on).
   * @param {string} userId
   * @param {string} category - task|project|content|approval|mention|system|workflow
   * @param {string} priority - high|medium|low
   */
  async shouldSendInAppNotification(userId, category, priority = 'medium') {
    const uid = normalizeUserId(userId);
    try {
      const settings = await UserSettings.findOne({ userId: uid }).lean();
      if (!settings?.notifications) return true;
      const { channels, categories, priorityTiers } = settings.notifications;
      if (channels && channels.inApp === false) return false;
      const cat = category || 'system';
      if (categories && typeof categories[cat] === 'boolean' && !categories[cat]) return false;
      if (priorityTiers === 'high_only' && priority !== 'high') return false;
      if (priorityTiers === 'high_medium' && priority === 'low') return false;
      return true;
    } catch (e) {
      logger.warn('shouldSendInAppNotification check failed', { userId: uid, error: e.message });
      return true;
    }
  }

  /**
   * Avoid duplicate task_delayed notifications for the same task within 24h.
   */
  async shouldCoalesceTaskDelayed(userId, taskId) {
    const uid = normalizeUserId(userId);
    const eid = taskId != null && typeof taskId === 'object' && taskId.toString ? taskId.toString() : String(taskId);
    try {
      const recent = await Notification.findOne({
        userId: uid,
        category: 'task',
        'context.entityId': eid,
        title: 'Task delayed',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).lean();
      return !!recent;
    } catch (e) {
      logger.warn('shouldCoalesceTaskDelayed check failed', { userId: uid, error: e.message });
      return false;
    }
  }

  /**
   * Create notification (persist + real-time). Used by task mentions, workflows, etc.
   * Respects UserSettings.notifications.categories and .channels.inApp.
   * @param {string} userId
   * @param {string} title
   * @param {string} message
   * @param {string} type - info|success|warning|error
   * @param {string} [link] - optional deep link
   * @param {object} [options] - priority, category, context, data, aiSummary, suggestion
   */
  async createNotification(userId, title, message, type = 'info', link = null, options = {}) {
    const uid = normalizeUserId(userId);
    const category = options.category || 'system';
    const priority = options.priority || 'medium';
    const allowed = await this.shouldSendInAppNotification(uid, category, priority);
    if (!allowed) {
      logger.debug('Notification skipped by user preferences', { userId: uid, category, priority });
      return null;
    }
    try {
      const doc = await Notification.create({
        userId: uid,
        type: type || 'info',
        priority: options.priority || 'medium',
        title: title || 'Notification',
        message: message || '',
        link: link || options.link || null,
        category: options.category || null,
        context: options.context || {},
        aiSummary: options.aiSummary || null,
        suggestion: options.suggestion || null,
        data: options.data || {}
      });
      const payload = {
        id: doc._id.toString(),
        type: doc.type,
        title: doc.title,
        message: doc.message,
        link: doc.link,
        category: doc.category,
        context: doc.context,
        aiSummary: doc.aiSummary,
        suggestion: doc.suggestion,
        data: doc.data || {},
        timestamp: doc.createdAt,
        read: false
      };
      this.notifyUser(uid, { ...payload, message: payload.message, data: payload.data });
      return doc;
    } catch (error) {
      logger.error('Error creating notification', { error: error.message, userId: uid });
      throw error;
    }
  }

  /**
   * Proactive notification for change events with AI-style summary and suggestion.
   * @param {string} userId
   * @param {string} changeType - task_delayed, task_status, milestone_completed, job_failed, etc.
   * @param {object} payload - change details for summary
   */
  async createNotificationForChange(userId, changeType, payload) {
    if (changeType === 'task_delayed' && (payload.taskId || payload.entityId)) {
      const coalesced = await this.shouldCoalesceTaskDelayed(userId, payload.taskId || payload.entityId);
      if (coalesced) {
        logger.debug('Task delayed notification coalesced (recent duplicate)', { userId: normalizeUserId(userId), taskId: payload.taskId || payload.entityId });
        return null;
      }
    }
    const { summary, suggestion, title, link, category, priority } = summarizeChange(changeType, payload);
    const message = suggestion ? `${summary} ${suggestion}` : summary;
    return this.createNotification(userId, title || summary, message, 'warning', link, {
      category: category || 'task',
      context: { entityId: payload.entityId || payload.taskId, entityType: payload.entityType || 'task' },
      aiSummary: summary,
      suggestion: suggestion || null,
      data: payload,
      priority: payload.priority || priority || 'medium'
    });
  }

  /**
   * Send notification to user (real-time only; no persist)
   */
  notifyUser(userId, notification) {
    try {
      const io = getIO();
      if (!io) {
        logger.warn('Socket.io not initialized, notification not sent');
        return;
      }

      const uid = normalizeUserId(userId);
      const notificationData = {
        id: notification.id || Date.now().toString(),
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        link: notification.link || null,
        category: notification.category || null,
        context: notification.context || null,
        aiSummary: notification.aiSummary || null,
        suggestion: notification.suggestion || null,
        data: notification.data || {},
        timestamp: notification.timestamp || new Date(),
        read: false
      };

      io.to(`user-${uid}`).emit('notification', notificationData);
      logger.info('Notification sent', { userId: uid, type: notification.type });
    } catch (error) {
      logger.error('Error sending notification', { error: error.message });
    }
  }

  /**
   * Send notification to all users (admin)
   */
  notifyAll(notification) {
    try {
      const io = getIO();
      if (!io) {
        logger.warn('Socket.io not initialized, notification not sent');
        return;
      }

      const notificationData = {
        id: Date.now().toString(),
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        timestamp: new Date(),
        read: false
      };

      io.emit('notification', notificationData);
      logger.info('Broadcast notification sent', { type: notification.type });
    } catch (error) {
      logger.error('Error sending broadcast notification', { error: error.message });
    }
  }

  /**
   * Notify about video processing completion
   */
  notifyVideoProcessed(userId, contentId, status) {
    this.notifyUser(userId, {
      type: status === 'completed' ? 'success' : 'error',
      title: 'Video Processing',
      message: status === 'completed' 
        ? 'Your video has been processed successfully!'
        : 'Video processing failed. Please try again.',
      data: { contentId, status }
    });
  }

  /**
   * Notify about content generation completion
   */
  notifyContentGenerated(userId, contentId, status) {
    this.notifyUser(userId, {
      type: status === 'completed' ? 'success' : 'error',
      title: 'Content Generation',
      message: status === 'completed'
        ? 'Your content has been generated successfully!'
        : 'Content generation failed. Please try again.',
      data: { contentId, status }
    });
  }

  /**
   * Notify about membership upgrade
   */
  notifyMembershipUpgraded(userId, packageName) {
    this.notifyUser(userId, {
      type: 'success',
      title: 'Membership Upgraded',
      message: `You've successfully upgraded to ${packageName}!`,
      data: { packageName }
    });
  }

  /**
   * Notify about usage limits
   */
  notifyUsageLimit(userId, limitType, percentage) {
    if (percentage >= 90) {
      this.notifyUser(userId, {
        type: 'warning',
        title: 'Usage Limit Warning',
        message: `You've used ${percentage}% of your ${limitType} limit. Consider upgrading your plan.`,
        data: { limitType, percentage }
      });
    }
  }
}

/**
 * AI-style summary and suggestion for change events (contextual, proactive).
 */
function summarizeChange(changeType, payload) {
  const entityName = payload.taskTitle || payload.entityName || payload.name || 'Item';
  const link = payload.link || (payload.taskId ? `/dashboard/tasks?open=${payload.taskId}` : null) || '/dashboard';
  switch (changeType) {
    case 'task_delayed':
      return {
        title: 'Task delayed',
        summary: `${entityName} was delayed by ${payload.daysDelayed ?? 'a few'} days.`,
        suggestion: payload.suggestAssignBackup !== false ? 'Assign a backup?' : null,
        link,
        category: 'task',
        priority: 'medium'
      };
    case 'task_status':
      return {
        title: 'Task status changed',
        summary: `${entityName} is now ${payload.newStatus || payload.status}.`,
        suggestion: payload.newStatus === 'in_progress' ? 'Consider adding a due date.' : null,
        link,
        category: 'task',
        priority: 'low'
      };
    case 'milestone_completed':
      return {
        title: 'Milestone completed',
        summary: `"${entityName}" is done.`,
        suggestion: payload.nextMilestone ? `Next: ${payload.nextMilestone}` : null,
        link: payload.projectId ? `/dashboard/projects` : link,
        category: 'project',
        priority: 'medium'
      };
    case 'job_failed':
      return {
        title: 'Job failed',
        summary: `${entityName || 'A job'} failed. ${payload.reason || 'Check the job for details.'}`,
        suggestion: 'Retry or check logs.',
        link: payload.jobId ? `/dashboard/jobs` : link,
        category: 'system',
        priority: 'high'
      };
    default:
      return {
        title: payload.title || 'Update',
        summary: payload.message || payload.summary || 'Something changed.',
        suggestion: payload.suggestion || null,
        link,
        category: payload.category || 'system',
        priority: payload.priority || 'medium'
      };
  }
}

const notificationService = new NotificationService();

/** Backward-compat: send notification (persist + real-time) from object shape. */
async function sendNotification(userId, notification) {
  const uid = normalizeUserId(userId);
  if (notification.title && notification.message) {
    try {
      await notificationService.createNotification(
        uid,
        notification.title,
        notification.message,
        notification.type || 'info',
        notification.link || null,
        {
          priority: notification.priority,
          category: notification.category,
          context: notification.context,
          data: notification.metadata || notification.data || {}
        }
      );
    } catch (e) {
      notificationService.notifyUser(uid, {
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        link: notification.link,
        data: notification.metadata || notification.data || {}
      });
    }
    return;
  }
  notificationService.notifyUser(uid, notification);
}

module.exports = notificationService;
module.exports.sendNotification = sendNotification;
module.exports.createNotification = (userId, title, message, type, link, options) =>
  notificationService.createNotification(userId, title, message, type, link, options);


// Real-time notification service

const logger = require('../utils/logger');
const { getIO } = require('./socketService');

class NotificationService {
  constructor() {
    this.io = null;
  }

  initialize(io) {
    this.io = io;
    logger.info('Notification service initialized');
  }

  /**
   * Send notification to user
   */
  notifyUser(userId, notification) {
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

      io.to(`user-${userId}`).emit('notification', notificationData);
      logger.info('Notification sent', { userId, type: notification.type });
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

const notificationService = new NotificationService();

module.exports = notificationService;


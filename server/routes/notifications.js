// Notification routes

const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  try {
    const { unread, limit = 50 } = req.query;
    const query = { userId: req.user._id };

    if (unread === 'true') {
      query.read = false;
    }

    let notifications = [];
    let unreadCount = 0;

    try {
      notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();
    } catch (dbError) {
      logger.warn('Error querying notifications', { error: dbError.message, userId: req.user._id });
    }

    try {
      unreadCount = await Notification.countDocuments({
        userId: req.user._id,
        read: false
      });
    } catch (countError) {
      logger.warn('Error counting unread notifications', { error: countError.message, userId: req.user._id });
    }

    sendSuccess(res, 'Notifications fetched', 200, {
      notifications: notifications || [],
      unreadCount: unreadCount || 0
    });
  } catch (error) {
    logger.error('Error fetching notifications', { error: error.message, userId: req.user._id, stack: error.stack });
    sendSuccess(res, 'Notifications fetched', 200, {
      notifications: [],
      unreadCount: 0
    });
  }
}));

/**
 * GET /api/notifications/unread-count
 * Convenience endpoint used by some UI widgets.
 */
router.get('/unread-count', auth, asyncHandler(async (req, res) => {
  try {
    let unreadCount = 0;
    try {
      unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    } catch (countError) {
      logger.warn('Error counting unread notifications', { error: countError.message, userId: req.user._id });
    }

    sendSuccess(res, 'Unread notifications count fetched', 200, { unreadCount: unreadCount || 0 });
  } catch (error) {
    logger.error('Error fetching unread notifications count', { error: error.message, userId: req.user._id, stack: error.stack });
    sendSuccess(res, 'Unread notifications count fetched', 200, { unreadCount: 0 });
  }
}));

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:notificationId/read', auth, asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.notificationId,
    userId: req.user._id
  });

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
  }

  notification.read = true;
  notification.readAt = new Date();
  await notification.save();

  sendSuccess(res, 'Notification marked as read', 200, notification);
}));

/**
 * @swagger
 * /api/notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.put('/read-all', auth, asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user._id, read: false },
    { read: true, readAt: new Date() }
  );

  sendSuccess(res, 'All notifications marked as read', 200, {
    updated: result.modifiedCount
  });
}));

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:notificationId', auth, asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.notificationId,
    userId: req.user._id
  });

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
  }

  sendSuccess(res, 'Notification deleted', 200);
}));

module.exports = router;








// Notification routes

const express = require('express');
const Notification = require('../models/Notification');
const UserSettings = require('../models/UserSettings');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const liveStatusService = require('../services/liveStatusService');
const jobQueueService = require('../services/jobQueueService');
const router = express.Router();

function getUserId(req) {
  const u = req.user;
  return u?._id ?? u?.id;
}

function normalizeUserId(userId) {
  return userId != null && typeof userId === 'object' && userId.toString
    ? userId.toString()
    : String(userId);
}

/**
 * Apply user's priority tier preference to notification query.
 * high_only => only high; high_medium => high + medium (missing = medium); all => no filter.
 */
function applyPriorityFilter(query, priorityTiers) {
  if (!priorityTiers || priorityTiers === 'all') return;
  if (priorityTiers === 'high_only') {
    query.priority = 'high';
  } else if (priorityTiers === 'high_medium') {
    query.$or = [
      { priority: 'high' },
      { priority: 'medium' },
      { priority: { $exists: false } }
    ];
  }
}

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications (respects priority tier setting)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  try {
    const { unread, limit = 50, category } = req.query;
    const userId = normalizeUserId(getUserId(req));
    const query = { userId };

    if (unread === 'true') {
      query.read = false;
    }
    if (category && ['task', 'project', 'content', 'approval', 'mention', 'system', 'workflow'].includes(category)) {
      query.category = category;
    }

    let priorityTiers = null;
    try {
      const settings = await UserSettings.findOne({ userId }).lean();
      priorityTiers = settings?.notifications?.priorityTiers;
    } catch (_) { /* ignore */ }
    applyPriorityFilter(query, priorityTiers);

    let notifications = [];
    let unreadCount = 0;

    try {
      notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit, 10) || 50)
        .lean();
    } catch (dbError) {
      logger.warn('Error querying notifications', { error: dbError.message, userId });
    }

    try {
      const countQuery = { userId, read: false };
      applyPriorityFilter(countQuery, priorityTiers);
      if (query.category) countQuery.category = query.category;
      unreadCount = await Notification.countDocuments(countQuery);
    } catch (countError) {
      logger.warn('Error counting unread notifications', { error: countError.message, userId });
    }

    sendSuccess(res, 'Notifications fetched', 200, {
      notifications: notifications || [],
      unreadCount: unreadCount || 0
    });
  } catch (error) {
    const userId = getUserId(req);
    logger.error('Error fetching notifications', { error: error.message, userId, stack: error.stack });
    sendSuccess(res, 'Notifications fetched', 200, {
      notifications: [],
      unreadCount: 0
    });
  }
}));

/**
 * GET /api/notifications/live-status
 * Persistent feed of in-progress items (tasks + jobs) for real-time badges.
 */
router.get('/live-status', auth, asyncHandler(async (req, res) => {
  const userId = normalizeUserId(getUserId(req));
  const [status, jobs] = await Promise.all([
    liveStatusService.getLiveStatus(userId),
    jobQueueService.getActiveJobsForUser(userId).catch(() => [])
  ]);
  sendSuccess(res, 'Live status fetched', 200, {
    tasks: status.tasks || [],
    jobs: jobs || [],
    lastUpdated: new Date().toISOString()
  });
}));

/**
 * GET /api/notifications/unread-count
 * Convenience endpoint used by some UI widgets.
 */
router.get('/unread-count', auth, asyncHandler(async (req, res) => {
  const userId = normalizeUserId(getUserId(req));
  try {
    let unreadCount = 0;
    try {
      const countQuery = { userId, read: false };
      let priorityTiers = null;
      try {
        const settings = await UserSettings.findOne({ userId }).lean();
        priorityTiers = settings?.notifications?.priorityTiers;
      } catch (_) { /* ignore */ }
      applyPriorityFilter(countQuery, priorityTiers);
      unreadCount = await Notification.countDocuments(countQuery);
    } catch (countError) {
      logger.warn('Error counting unread notifications', { error: countError.message, userId });
    }

    sendSuccess(res, 'Unread notifications count fetched', 200, { unreadCount: unreadCount || 0 });
  } catch (error) {
    logger.error('Error fetching unread notifications count', { error: error.message, userId, stack: error.stack });
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
  const userId = normalizeUserId(getUserId(req));
  const notification = await Notification.findOne({
    _id: req.params.notificationId,
    userId
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
  const userId = normalizeUserId(getUserId(req));
  const query = { userId, read: false };
  let priorityTiers = null;
  try {
    const settings = await UserSettings.findOne({ userId }).lean();
    priorityTiers = settings?.notifications?.priorityTiers;
  } catch (_) { /* ignore */ }
  applyPriorityFilter(query, priorityTiers);
  const result = await Notification.updateMany(
    query,
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
    userId: normalizeUserId(getUserId(req))
  });

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
  }

  sendSuccess(res, 'Notification deleted', 200);
}));

module.exports = router;








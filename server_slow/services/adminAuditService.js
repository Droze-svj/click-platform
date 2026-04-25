// Admin Audit Log Service

const SecurityLog = require('../models/SecurityLog');
const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Log admin action
 */
async function logAdminAction(adminId, action, details = {}) {
  try {
    const auditLog = new SecurityLog({
      userId: adminId,
      eventType: `admin.${action}`,
      details: {
        ...details,
        action,
        timestamp: new Date(),
      },
      severity: 'info',
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
    });

    await auditLog.save();
    logger.info('Admin action logged', { adminId, action });
    return auditLog;
  } catch (error) {
    logger.error('Log admin action error', { error: error.message, adminId, action });
    throw error;
  }
}

/**
 * Get audit logs
 */
async function getAuditLogs(options = {}) {
  try {
    const {
      userId = null,
      eventType = null,
      startDate = null,
      endDate = null,
      limit = 100,
      skip = 0,
    } = options;

    const query = {
      eventType: { $regex: /^admin\./ },
    };

    if (userId) {
      query.userId = userId;
    }

    if (eventType) {
      query.eventType = `admin.${eventType}`;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      SecurityLog.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate('userId', 'name email')
        .lean(),
      SecurityLog.countDocuments(query),
    ]);

    return {
      logs,
      total,
      limit,
      skip,
    };
  } catch (error) {
    logger.error('Get audit logs error', { error: error.message });
    throw error;
  }
}

/**
 * Get admin activity summary
 */
async function getAdminActivitySummary(period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const [
      totalActions,
      actionsByType,
      topAdmins,
      recentActions,
    ] = await Promise.all([
      SecurityLog.countDocuments({
        eventType: { $regex: /^admin\./ },
        createdAt: { $gte: startDate },
      }),
      SecurityLog.aggregate([
        {
          $match: {
            eventType: { $regex: /^admin\./ },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]),
      SecurityLog.aggregate([
        {
          $match: {
            eventType: { $regex: /^admin\./ },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $project: {
            userId: '$_id',
            name: '$user.name',
            email: '$user.email',
            count: 1,
          },
        },
      ]),
      SecurityLog.find({
        eventType: { $regex: /^admin\./ },
        createdAt: { $gte: startDate },
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('userId', 'name email')
        .lean(),
    ]);

    return {
      period,
      totalActions,
      actionsByType: actionsByType.map(item => ({
        type: item._id.replace('admin.', ''),
        count: item.count,
      })),
      topAdmins,
      recentActions,
    };
  } catch (error) {
    logger.error('Get admin activity summary error', { error: error.message });
    throw error;
  }
}

module.exports = {
  logAdminAction,
  getAuditLogs,
  getAdminActivitySummary,
};







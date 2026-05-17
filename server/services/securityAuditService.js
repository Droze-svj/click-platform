// Enhanced Security Audit Service

const SecurityLog = require('../models/SecurityLog');
const logger = require('../utils/logger');

/**
 * Log security event
 */
async function logSecurityEvent(eventType, details = {}) {
  try {
    const log = new SecurityLog({
      userId: details.userId,
      eventType: eventType,
      severity: details.severity || 'low',
      ipAddress: details.ip || '0.0.0.0',
      userAgent: details.userAgent,
      details: details.metadata || {},
      metadata: {
        path: details.path,
        method: details.method
      }
    });

    await log.save();

    if (['failed_login', 'suspicious_activity', 'unauthorized_access', 'account_locked'].includes(eventType)) {
      logger.warn('Security alert', {
        eventType,
        userId: details.userId,
        ip: details.ip,
      });
    }

    return { logged: true, id: log._id };
  } catch (error) {
    logger.error('Log security event error', { error: error.message, eventType });
    return null;
  }
}

/**
 * Detect suspicious activity
 */
async function detectSuspiciousActivity(userId, ip, _userAgent) {
  try {
    // Check for multiple failed logins in short period
    const recentFailed = await SecurityLog.countDocuments({
      ipAddress: ip,
      eventType: 'login_failed',
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Last 15 mins
    });

    if (recentFailed > 5) {
      return { suspicious: true, reason: 'excessive_failed_logins', count: recentFailed };
    }

    return { suspicious: false };
  } catch (error) {
    logger.error('Detect suspicious activity error', { error: error.message, userId });
    return { suspicious: false };
  }
}

/**
 * Get security events for user
 */
async function getUserSecurityEvents(userId, limit = 50) {
  try {
    const events = await SecurityLog.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('-__v');

    return events;
  } catch (error) {
    logger.error('Get user security events error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get security statistics
 */
async function getSecurityStatistics(options = {}) {
  try {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
    } = options;

    const events = await SecurityLog.find({
      timestamp: { $gte: startDate, $lte: endDate },
    });

    const statistics = {
      totalEvents: events.length,
      eventsByType: {},
      eventsByStatus: {},
      topIPs: {},
      uniqueUsers: new Set(),
    };

    events.forEach(event => {
      // By type
      statistics.eventsByType[event.event] = (statistics.eventsByType[event.event] || 0) + 1;

      // By status
      const status = event.statusCode >= 400 ? 'failed' : 'success';
      statistics.eventsByStatus[status] = (statistics.eventsByStatus[status] || 0) + 1;

      // Top IPs
      if (event.ip) {
        statistics.topIPs[event.ip] = (statistics.topIPs[event.ip] || 0) + 1;
      }

      // Unique users
      if (event.userId) {
        statistics.uniqueUsers.add(event.userId.toString());
      }
    });

    return {
      ...statistics,
      eventsByType: Object.entries(statistics.eventsByType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count })),
      topIPs: Object.entries(statistics.topIPs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count })),
      uniqueUsersCount: statistics.uniqueUsers.size,
      period: { startDate, endDate },
    };
  } catch (error) {
    logger.error('Get security statistics error', { error: error.message });
    throw error;
  }
}

module.exports = {
  logSecurityEvent,
  detectSuspiciousActivity,
  getUserSecurityEvents,
  getSecurityStatistics,
};

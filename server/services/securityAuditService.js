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
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v')
      .lean();

    return { events, total: events.length };
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
      userId = null,
    } = options;

    // SecurityLog uses `createdAt` (not `timestamp`) and `eventType`/
    // `ipAddress`/`severity` (not `event`/`ip`/`statusCode`). Query and
    // aggregate against the real schema fields. Scope to a user when provided.
    const query = { createdAt: { $gte: startDate, $lte: endDate } };
    if (userId) query.userId = userId;

    const events = await SecurityLog.find(query).lean();

    const statistics = {
      totalEvents: events.length,
      eventsByType: {},
      eventsBySeverity: {},
      topIPs: {},
      uniqueUsers: new Set(),
      recentEvents: [],
    };

    events.forEach(event => {
      if (event.eventType) {
        statistics.eventsByType[event.eventType] = (statistics.eventsByType[event.eventType] || 0) + 1;
      }
      const severity = event.severity || 'low';
      statistics.eventsBySeverity[severity] = (statistics.eventsBySeverity[severity] || 0) + 1;

      if (event.ipAddress) {
        statistics.topIPs[event.ipAddress] = (statistics.topIPs[event.ipAddress] || 0) + 1;
      }
      if (event.userId) {
        statistics.uniqueUsers.add(event.userId.toString());
      }
    });

    // Most recent 10 events for the dashboard timeline.
    const recentEvents = [...events]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(e => ({ eventType: e.eventType, severity: e.severity, ipAddress: e.ipAddress, createdAt: e.createdAt }));

    return {
      totalEvents: statistics.totalEvents,
      eventsByType: Object.entries(statistics.eventsByType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count })),
      eventsBySeverity: statistics.eventsBySeverity,
      topIPs: Object.entries(statistics.topIPs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count })),
      uniqueUsersCount: statistics.uniqueUsers.size,
      recentEvents,
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

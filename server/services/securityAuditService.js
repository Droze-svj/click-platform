// Enhanced Security Audit Service

const SecurityLog = require('../models/SecurityLog');
const logger = require('../utils/logger');
const { maskSensitiveData } = require('../utils/dataEncryption');

/**
 * Log security event
 */
async function logSecurityEvent(event, details = {}) {
  try {
    // Temporarily disable security logging since we're using Supabase instead of MongoDB
    // TODO: Create security_logs table in Supabase and implement proper logging

    // For now, just log critical events to console
    if (['failed_login', 'suspicious_activity', 'unauthorized_access'].includes(event)) {
      logger.warn('Security event', {
        event,
        userId: details.userId,
        ip: details.ip,
        path: details.path,
      });
    }

    return { logged: true, method: 'console_only' };
  } catch (error) {
    logger.error('Log security event error', { error: error.message, event });
    return null;
  }
}

/**
 * Detect suspicious activity
 */
async function detectSuspiciousActivity(userId, ip, userAgent) {
  try {
    // Temporarily disable suspicious activity detection since we're using Supabase
    // TODO: Implement suspicious activity detection using Supabase tables

    // Return safe default for now
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

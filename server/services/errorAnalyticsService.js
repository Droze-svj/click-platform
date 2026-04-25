// Error Analytics Service

const ErrorLog = require('../models/ErrorLog');
const logger = require('../utils/logger');

/**
 * Log error for analytics
 */
async function logErrorForAnalytics(error, context = {}) {
  try {
    const errorLog = new ErrorLog({
      errorType: error.name || 'Error',
      errorMessage: error.message,
      statusCode: error.statusCode || 500,
      errorCode: error.code,
      stack: error.stack,
      userId: context.userId,
      path: context.path,
      method: context.method,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: context.metadata || {},
      timestamp: new Date(),
    });

    await errorLog.save();
    return errorLog;
  } catch (logError) {
    logger.error('Failed to log error for analytics', { error: logError.message });
    return null;
  }
}

/**
 * Get error statistics
 */
async function getErrorStatistics(options = {}) {
  try {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate = new Date(),
      groupBy = 'hour', // hour, day, week
    } = options;

    const errors = await ErrorLog.find({
      timestamp: { $gte: startDate, $lte: endDate },
    });

    // Calculate statistics
    const totalErrors = errors.length;
    const errorsByType = {};
    const errorsByStatusCode = {};
    const errorsByPath = {};
    const errorRate = [];

    errors.forEach(error => {
      // By type
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;

      // By status code
      const statusCode = error.statusCode || 500;
      errorsByStatusCode[statusCode] = (errorsByStatusCode[statusCode] || 0) + 1;

      // By path
      if (error.path) {
        errorsByPath[error.path] = (errorsByPath[error.path] || 0) + 1;
      }

      // Error rate over time
      const timeKey = getTimeKey(error.timestamp, groupBy);
      if (!errorRate.find(e => e.time === timeKey)) {
        errorRate.push({ time: timeKey, count: 0 });
      }
      const rateEntry = errorRate.find(e => e.time === timeKey);
      rateEntry.count++;
    });

    // Calculate trends
    const criticalErrors = errors.filter(e => e.statusCode >= 500).length;
    const clientErrors = errors.filter(e => e.statusCode >= 400 && e.statusCode < 500).length;
    const uniqueUsers = new Set(errors.filter(e => e.userId).map(e => e.userId.toString())).size;

    return {
      totalErrors,
      criticalErrors,
      clientErrors,
      uniqueUsersAffected: uniqueUsers,
      errorsByType: Object.entries(errorsByType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count })),
      errorsByStatusCode: Object.entries(errorsByStatusCode)
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({ code: parseInt(code), count })),
      topErrorPaths: Object.entries(errorsByPath)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count })),
      errorRate: errorRate.sort((a, b) => a.time.localeCompare(b.time)),
      period: { startDate, endDate },
    };
  } catch (error) {
    logger.error('Get error statistics error', { error: error.message });
    throw error;
  }
}

/**
 * Get time key for grouping
 */
function getTimeKey(timestamp, groupBy) {
  const date = new Date(timestamp);
  switch (groupBy) {
    case 'hour':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
    case 'day':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 6) / 7)).padStart(2, '0')}`;
    default:
      return date.toISOString();
  }
}

/**
 * Get error trends
 */
async function getErrorTrends(days = 7) {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const errors = await ErrorLog.find({
      timestamp: { $gte: startDate, $lte: endDate },
    }).sort({ timestamp: 1 });

    // Group by day
    const dailyErrors = {};
    errors.forEach(error => {
      const dayKey = getTimeKey(error.timestamp, 'day');
      if (!dailyErrors[dayKey]) {
        dailyErrors[dayKey] = { total: 0, critical: 0, client: 0 };
      }
      dailyErrors[dayKey].total++;
      if (error.statusCode >= 500) {
        dailyErrors[dayKey].critical++;
      } else if (error.statusCode >= 400) {
        dailyErrors[dayKey].client++;
      }
    });

    // Calculate trends
    const trendData = Object.entries(dailyErrors)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        ...counts,
      }));

    // Calculate percentage change
    let trend = 'stable';
    if (trendData.length >= 2) {
      const recent = trendData.slice(-3).reduce((sum, d) => sum + d.total, 0) / 3;
      const older = trendData.slice(0, 3).reduce((sum, d) => sum + d.total, 0) / 3;
      const change = ((recent - older) / older) * 100;

      if (change > 10) trend = 'increasing';
      else if (change < -10) trend = 'decreasing';
    }

    return {
      trend,
      dailyData: trendData,
      averageDailyErrors: errors.length / days,
    };
  } catch (error) {
    logger.error('Get error trends error', { error: error.message });
    throw error;
  }
}

/**
 * Get most common errors
 */
async function getMostCommonErrors(limit = 10) {
  try {
    const errors = await ErrorLog.aggregate([
      {
        $group: {
          _id: {
            errorType: '$errorType',
            errorMessage: '$errorMessage',
            statusCode: '$statusCode',
          },
          count: { $sum: 1 },
          lastOccurrence: { $max: '$timestamp' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return errors.map(error => ({
      errorType: error._id.errorType,
      errorMessage: error._id.errorMessage,
      statusCode: error._id.statusCode,
      count: error.count,
      lastOccurrence: error.lastOccurrence,
    }));
  } catch (error) {
    logger.error('Get most common errors error', { error: error.message });
    throw error;
  }
}

/**
 * Check if error rate exceeds threshold
 */
async function checkErrorRateThreshold(threshold = 100) {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const errorCount = await ErrorLog.countDocuments({
      timestamp: { $gte: oneHourAgo },
      statusCode: { $gte: 500 },
    });

    return {
      exceedsThreshold: errorCount > threshold,
      currentRate: errorCount,
      threshold,
      alert: errorCount > threshold ? 'HIGH_ERROR_RATE' : null,
    };
  } catch (error) {
    logger.error('Check error rate threshold error', { error: error.message });
    throw error;
  }
}

module.exports = {
  logErrorForAnalytics,
  getErrorStatistics,
  getErrorTrends,
  getMostCommonErrors,
  checkErrorRateThreshold,
};






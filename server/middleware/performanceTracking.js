// Performance tracking middleware

const performanceMonitor = require('../utils/performanceMonitor');
const { trackRequest, trackError } = require('../services/performanceMonitoringService');
const { checkResponseTime, trackConsecutiveError, resetConsecutiveErrors } = require('../services/alertingService');

/**
 * Track request performance
 */
const trackPerformance = (req, res, next) => {
  const startTime = Date.now();

  // Track response
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    // Track with existing monitor
    if (performanceMonitor && performanceMonitor.recordRequest) {
      performanceMonitor.recordRequest(responseTime, success);
    }

    // Track with new monitoring service
    trackRequest(req.method, req.path, responseTime, res.statusCode);

    // Check for slow requests and alert
    if (responseTime > 1000) {
      const logger = require('../utils/logger');
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        responseTime: responseTime + 'ms',
        statusCode: res.statusCode
      });
    }

    // Check average response time (async, don't block)
    if (process.env.NODE_ENV === 'production') {
      checkResponseTime(responseTime).catch(err => {
        // Silent fail for monitoring
      });
    }

    // Reset consecutive errors on success
    if (success) {
      resetConsecutiveErrors();
    }
  });

  // Track errors
  res.on('error', (error) => {
    trackError(error, {
      method: req.method,
      path: req.path,
      userId: req.user?._id,
    });
    trackConsecutiveError(error);
  });

  next();
};

/**
 * Track database query performance
 */
const trackDatabaseQuery = (queryTime, isSlow = false) => {
  performanceMonitor.recordDatabaseQuery(queryTime, isSlow);
};

/**
 * Track cache operations
 */
const trackCacheOperation = (hit) => {
  performanceMonitor.recordCacheOperation(hit);
};

module.exports = {
  trackPerformance,
  trackDatabaseQuery,
  trackCacheOperation
};





// Performance Tracking Middleware

const performanceMonitoringService = require('../services/performanceMonitoringService');

/**
 * Track API request performance
 */
function trackPerformance(req, res, next) {
  const startTime = Date.now();

  // Track response time when response finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const endpoint = req.path || req.originalUrl;
    const method = req.method;

    performanceMonitoringService.trackAPIRequest(
      endpoint,
      method,
      responseTime,
      res.statusCode
    );
  });

  next();
}

module.exports = trackPerformance;

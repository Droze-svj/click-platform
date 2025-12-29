// Performance Monitoring Service

const logger = require('../utils/logger');
const { captureMessage, startTransaction } = require('../utils/sentry');

// In-memory metrics (in production, use Redis or time-series DB)
const metrics = {
  requests: [],
  errors: [],
  slowQueries: [],
  apiCalls: [],
};

/**
 * Track API request performance
 */
function trackRequest(method, path, duration, statusCode) {
  const metric = {
    method,
    path,
    duration,
    statusCode,
    timestamp: Date.now(),
  };

  metrics.requests.push(metric);

  // Keep only last 1000 requests
  if (metrics.requests.length > 1000) {
    metrics.requests.shift();
  }

  // Log slow requests (>1s)
  if (duration > 1000) {
    logger.warn('Slow request detected', { method, path, duration });
    metrics.slowQueries.push(metric);
    
    // Keep only last 100 slow queries
    if (metrics.slowQueries.length > 100) {
      metrics.slowQueries.shift();
    }
  }

  // Send to Sentry if very slow (>5s)
  if (duration > 5000) {
    captureMessage('Very slow request detected', 'warning', {
      tags: { path, method },
      extra: { duration, statusCode },
    });
  }
}

/**
 * Track error
 */
function trackError(error, context = {}) {
  const errorMetric = {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: Date.now(),
  };

  metrics.errors.push(errorMetric);

  // Keep only last 500 errors
  if (metrics.errors.length > 500) {
    metrics.errors.shift();
  }
}

/**
 * Track external API call
 */
function trackApiCall(service, endpoint, duration, success) {
  const apiMetric = {
    service,
    endpoint,
    duration,
    success,
    timestamp: Date.now(),
  };

  metrics.apiCalls.push(apiMetric);

  // Keep only last 500 API calls
  if (metrics.apiCalls.length > 500) {
    metrics.apiCalls.shift();
  }
}

/**
 * Get performance metrics
 */
function getMetrics(timeWindow = 3600000) { // Default 1 hour
  const now = Date.now();
  const cutoff = now - timeWindow;

  const recentRequests = metrics.requests.filter(r => r.timestamp > cutoff);
  const recentErrors = metrics.errors.filter(e => e.timestamp > cutoff);
  const recentApiCalls = metrics.apiCalls.filter(a => a.timestamp > cutoff);

  // Calculate statistics
  const requestDurations = recentRequests.map(r => r.duration);
  const avgDuration = requestDurations.length > 0
    ? requestDurations.reduce((a, b) => a + b, 0) / requestDurations.length
    : 0;

  const p95Duration = requestDurations.length > 0
    ? requestDurations.sort((a, b) => a - b)[Math.floor(requestDurations.length * 0.95)]
    : 0;

  const p99Duration = requestDurations.length > 0
    ? requestDurations.sort((a, b) => a - b)[Math.floor(requestDurations.length * 0.99)]
    : 0;

  // Status code distribution
  const statusCodes = {};
  recentRequests.forEach(r => {
    statusCodes[r.statusCode] = (statusCodes[r.statusCode] || 0) + 1;
  });

  // Error rate
  const errorRate = recentRequests.length > 0
    ? (recentErrors.length / recentRequests.length) * 100
    : 0;

  // API call success rate
  const apiSuccessRate = recentApiCalls.length > 0
    ? (recentApiCalls.filter(a => a.success).length / recentApiCalls.length) * 100
    : 100;

  return {
    timeWindow: timeWindow / 1000, // Convert to seconds
    requests: {
      total: recentRequests.length,
      averageDuration: Math.round(avgDuration),
      p95Duration: Math.round(p95Duration),
      p99Duration: Math.round(p99Duration),
      slowRequests: metrics.slowQueries.filter(q => q.timestamp > cutoff).length,
      statusCodes,
    },
    errors: {
      total: recentErrors.length,
      errorRate: Math.round(errorRate * 100) / 100,
      recent: recentErrors.slice(-10), // Last 10 errors
    },
    apiCalls: {
      total: recentApiCalls.length,
      successRate: Math.round(apiSuccessRate * 100) / 100,
      byService: recentApiCalls.reduce((acc, call) => {
        acc[call.service] = (acc[call.service] || 0) + 1;
        return acc;
      }, {}),
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      unit: 'MB',
    },
    uptime: process.uptime(),
  };
}

/**
 * Get slow queries
 */
function getSlowQueries(limit = 20) {
  return metrics.slowQueries
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit);
}

/**
 * Get recent errors
 */
function getRecentErrors(limit = 20) {
  return metrics.errors
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Clear old metrics
 */
function clearOldMetrics(maxAge = 86400000) { // Default 24 hours
  const cutoff = Date.now() - maxAge;

  metrics.requests = metrics.requests.filter(r => r.timestamp > cutoff);
  metrics.errors = metrics.errors.filter(e => e.timestamp > cutoff);
  metrics.slowQueries = metrics.slowQueries.filter(q => q.timestamp > cutoff);
  metrics.apiCalls = metrics.apiCalls.filter(a => a.timestamp > cutoff);

  logger.info('Old metrics cleared', { cutoff: new Date(cutoff).toISOString() });
}

// Clear old metrics every hour
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    clearOldMetrics();
  }, 3600000); // 1 hour
}

module.exports = {
  trackRequest,
  trackError,
  trackApiCall,
  getMetrics,
  getSlowQueries,
  getRecentErrors,
  clearOldMetrics,
};





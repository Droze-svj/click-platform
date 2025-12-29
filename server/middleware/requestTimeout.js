// Request timeout middleware

const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

/**
 * Request timeout middleware
 */
function requestTimeout(timeoutMs = 30000) {
  return (req, res, next) => {
    // Set timeout
    req.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          url: req.originalUrl,
          method: req.method,
          timeout: timeoutMs,
        });

        res.status(504).json({
          success: false,
          error: 'Request timeout',
          message: `Request exceeded ${timeoutMs / 1000} seconds`,
          code: 'REQUEST_TIMEOUT',
        });
      }
    });

    next();
  };
}

/**
 * Route-specific timeout middleware
 */
function routeTimeout(timeoutMs) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Route timeout', {
          url: req.originalUrl,
          method: req.method,
          timeout: timeoutMs,
        });

        res.status(504).json({
          success: false,
          error: 'Request timeout',
          message: `Operation exceeded ${timeoutMs / 1000} seconds`,
          code: 'ROUTE_TIMEOUT',
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Timeout configuration for different route types
 */
const timeoutConfig = {
  default: 30000, // 30 seconds
  upload: 300000, // 5 minutes for file uploads
  processing: 600000, // 10 minutes for processing operations
  analytics: 60000, // 1 minute for analytics
  auth: 10000, // 10 seconds for auth
  api: 30000, // 30 seconds for API calls
};

/**
 * Get timeout for route type
 */
function getTimeoutForRoute(routeType = 'default') {
  return timeoutConfig[routeType] || timeoutConfig.default;
}

module.exports = {
  requestTimeout,
  routeTimeout,
  getTimeoutForRoute,
  timeoutConfig,
};

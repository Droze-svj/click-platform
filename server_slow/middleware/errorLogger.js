// Error Logger Middleware

const logger = require('../utils/logger');
const { buildErrorContext } = require('../utils/errorHandler');

/**
 * Log errors to file and external services
 */
function errorLogger(err, req, res, next) {
  const context = buildErrorContext(req, err);

  // Log to file
  logger.error('API Error', {
    ...context,
    statusCode: err.statusCode || 500,
    errorName: err.name,
  });

  // In production, send to error tracking service (Sentry, etc.)
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry.captureException(err, { extra: context });
  }

  next(err);
}

module.exports = errorLogger;







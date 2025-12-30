// Enhanced Error Handler Middleware

const {
  handleError,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  buildErrorContext,
} = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');
const { ErrorDeduplicator } = require('../utils/errorRecovery');
const errorLogger = require('./errorLogger');

// Global error deduplicator
const errorDeduplicator = new ErrorDeduplicator();

// Clean up old entries every 10 minutes
setInterval(() => {
  errorDeduplicator.clearOldEntries();
}, 10 * 60 * 1000);

/**
 * Enhanced error handler middleware
 */
function enhancedErrorHandler(err, req, res, next) {
  // Check for duplicate errors
  const isDuplicate = errorDeduplicator.isDuplicate(err, {
    path: req.path,
    method: req.method,
  });

  const duplicateCount = errorDeduplicator.getDuplicateCount(err, {
    path: req.path,
    method: req.method,
  });

  // Log duplicate count if significant
  if (isDuplicate && duplicateCount > 10) {
    logger.warn('Duplicate error detected', {
      error: err.message,
      count: duplicateCount,
      path: req.path,
    });
  }

  // Log error first (skip if duplicate and already logged recently)
  if (!isDuplicate || duplicateCount <= 5) {
    errorLogger(err, req, res, () => {});
  }

  // Build error context
  const context = buildErrorContext(req, err);

  // Handle known error types
  if (err instanceof AppError) {
    return handleError(err, req, res);
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const fields = Object.keys(err.errors || {}).map(key => ({
      field: key,
      message: err.errors[key].message,
    }));
    const validationError = new ValidationError('Validation failed', fields);
    return handleError(validationError, req, res);
  }

  // Handle Mongoose cast errors (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    const notFoundError = new NotFoundError('Resource');
    return handleError(notFoundError, req, res);
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const conflictError = new ConflictError(`${field} already exists`);
    return handleError(conflictError, req, res);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    const authError = new AuthenticationError('Invalid token');
    return handleError(authError, req, res);
  }

  if (err.name === 'TokenExpiredError') {
    const authError = new AuthenticationError('Token expired');
    return handleError(authError, req, res);
  }

  // Handle OpenAI API errors
  if (err.response?.status === 429) {
    const rateLimitError = new RateLimitError('OpenAI API rate limit exceeded');
    rateLimitError.retryAfter = err.response.headers['retry-after'] || 60;
    return handleError(rateLimitError, req, res);
  }

  if (err.response?.status === 503) {
    const serviceError = new ServiceUnavailableError('OpenAI API');
    return handleError(serviceError, req, res);
  }

  // Handle network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    const serviceError = new ServiceUnavailableError('External service');
    return handleError(serviceError, req, res);
  }

  // Handle unknown errors
  const unknownError = new AppError(
    err.message || 'Internal server error',
    500,
    false
  );
  return handleError(unknownError, req, res);
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  return handleError(error, req, res);
}

/**
 * Unhandled promise rejection handler
 */
function setupUnhandledRejectionHandler() {
  process.on('unhandledRejection', (reason, promise) => {
    // Filter out Redis localhost connection errors - these are expected when REDIS_URL is not set
    if (reason && typeof reason === 'object' && reason.message && 
        reason.message.includes('ECONNREFUSED') && reason.message.includes('127.0.0.1:6379')) {
      // These are expected when REDIS_URL is not configured - workers will be closed automatically
      // Don't spam logs with these errors
      return;
    }
    
    logger.error('Unhandled Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise,
    });
    // In production, you might want to exit the process
    // process.exit(1);
  });
}

/**
 * Uncaught exception handler
 */
function setupUncaughtExceptionHandler() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });
    // Exit process for uncaught exceptions
    process.exit(1);
  });
}

/**
 * Initialize error handlers
 */
function initErrorHandlers() {
  setupUnhandledRejectionHandler();
  setupUncaughtExceptionHandler();
  logger.info('✅ Error handlers initialized');
}

module.exports = {
  enhancedErrorHandler,
  notFoundHandler,
  initErrorHandlers,
};


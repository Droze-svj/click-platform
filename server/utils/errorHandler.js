// Enhanced Error Handler Utility

const logger = require('./logger');
const { sendError } = require('./response');
const { getRecoverySuggestions } = require('./errorRecovery');
const { logErrorForAnalytics } = require('../services/errorAnalyticsService');

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, fields = []) {
    super(message, 400);
    this.fields = fields;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service = 'Service') {
    super(`${service} is currently unavailable`, 503);
  }
}

/**
 * Handle errors based on type
 * Note: This is async but we don't await analytics logging to avoid blocking
 */
function handleError(error, req, res) {
  // Log error
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode || 500,
    path: req.path,
    method: req.method,
    userId: req.user?._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  // Log based on severity
  if (error.statusCode >= 500) {
    logger.error('Server error', errorInfo);
  } else {
    logger.warn('Client error', errorInfo);
  }

  // Log for analytics (fire and forget)
  setImmediate(() => {
    logErrorForAnalytics(error, {
      userId: req.user?._id,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: error.metadata || {},
    }).catch(err => logger.warn('Failed to log error for analytics', { error: err.message }));
  });

  // Send error response
  const statusCode = error.statusCode || 500;
  const message = error.isOperational || process.env.NODE_ENV === 'production'
    ? error.message
    : error.message;

  // Include stack trace in development
  const response = {
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  };

  // Add additional info for specific error types
  if (error instanceof ValidationError && error.fields) {
    response.fields = error.fields;
  }

  if (error.statusCode === 429) {
    response.retryAfter = error.retryAfter || 60;
  }

  // Add recovery suggestions
  const recovery = getRecoverySuggestions(error);
  response.recovery = {
    message: recovery.message,
    actions: recovery.actions,
    retryable: recovery.retryable,
    retryAfter: recovery.retryAfter,
  };

  return sendError(res, message, statusCode, response);
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Error recovery strategies
 */
const recoveryStrategies = {
  retry: async (fn, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  },

  fallback: async (primaryFn, fallbackFn) => {
    try {
      return await primaryFn();
    } catch (error) {
      logger.warn('Primary function failed, using fallback', { error: error.message });
      return await fallbackFn();
    }
  },

  timeout: async (fn, timeoutMs = 5000) => {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      ),
    ]);
  },
};

/**
 * Validate and sanitize error messages for client
 */
function sanitizeErrorMessage(error, isProduction = false) {
  if (isProduction) {
    // Don't expose internal errors in production
    if (!error.isOperational) {
      return 'An unexpected error occurred. Please try again later.';
    }
    return error.message;
  }
  return error.message;
}

/**
 * Error context builder
 */
function buildErrorContext(req, error) {
  return {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userId: req.user?._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    error: {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode || 500,
    },
  };
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  handleError,
  asyncHandler,
  recoveryStrategies,
  sanitizeErrorMessage,
  buildErrorContext,
};



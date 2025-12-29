// Error Injection Utilities for Testing

const { AppError, ValidationError, ServiceUnavailableError } = require('./errorHandler');

/**
 * Inject error for testing purposes
 */
function injectError(errorType, options = {}) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Error injection is disabled in production');
  }

  const {
    message,
    statusCode,
    fields,
    metadata,
  } = options;

  switch (errorType) {
    case 'validation':
      throw new ValidationError(
        message || 'Validation error injected for testing',
        fields || []
      );

    case 'authentication':
      throw new AppError(
        message || 'Authentication error injected for testing',
        401
      );

    case 'authorization':
      throw new AppError(
        message || 'Authorization error injected for testing',
        403
      );

    case 'notFound':
      throw new AppError(
        message || 'Not found error injected for testing',
        404
      );

    case 'rateLimit':
      const rateLimitError = new AppError(
        message || 'Rate limit error injected for testing',
        429
      );
      rateLimitError.retryAfter = options.retryAfter || 60;
      throw rateLimitError;

    case 'serviceUnavailable':
      throw new ServiceUnavailableError(
        message || 'Service unavailable error injected for testing'
      );

    case 'internal':
      throw new AppError(
        message || 'Internal error injected for testing',
        500
      );

    case 'timeout':
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;

    case 'network':
      const networkError = new Error('Network error');
      networkError.code = 'ECONNREFUSED';
      throw networkError;

    default:
      throw new AppError(
        message || 'Unknown error injected for testing',
        500
      );
  }
}

/**
 * Conditional error injection based on probability
 */
function injectErrorWithProbability(errorType, probability = 0.1, options = {}) {
  if (process.env.NODE_ENV === 'production') {
    return; // Don't inject in production
  }

  if (Math.random() < probability) {
    injectError(errorType, options);
  }
}

/**
 * Inject error after delay (for testing async scenarios)
 */
function injectErrorAfterDelay(errorType, delay = 1000, options = {}) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        injectError(errorType, options);
        resolve();
      } catch (error) {
        reject(error);
      }
    }, delay);
  });
}

/**
 * Error injection middleware for testing
 */
function errorInjectionMiddleware(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  // Check for error injection header
  const errorType = req.headers['x-inject-error'];
  if (errorType) {
    try {
      injectError(errorType, {
        message: req.headers['x-inject-error-message'],
        statusCode: parseInt(req.headers['x-inject-error-status'] || '500'),
      });
    } catch (error) {
      return next(error);
    }
  }

  next();
}

module.exports = {
  injectError,
  injectErrorWithProbability,
  injectErrorAfterDelay,
  errorInjectionMiddleware,
};






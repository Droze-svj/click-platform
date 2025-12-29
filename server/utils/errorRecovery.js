// Error Recovery Utilities

const logger = require('./logger');
const { AppError, ServiceUnavailableError } = require('./errorHandler');

/**
 * Error recovery suggestions based on error type
 */
const recoverySuggestions = {
  ValidationError: {
    message: 'Please check your input and try again.',
    actions: [
      'Review the form fields for missing or invalid data',
      'Check that all required fields are filled',
      'Verify data formats match requirements',
    ],
    retryable: false,
  },
  AuthenticationError: {
    message: 'Please log in to continue.',
    actions: [
      'Check if your session has expired',
      'Try logging in again',
      'Clear browser cookies if issue persists',
    ],
    retryable: false,
  },
  AuthorizationError: {
    message: 'You do not have permission for this action.',
    actions: [
      'Contact your administrator for access',
      'Check your subscription plan',
      'Verify your account permissions',
    ],
    retryable: false,
  },
  NotFoundError: {
    message: 'The requested resource was not found.',
    actions: [
      'Verify the resource ID is correct',
      'Check if the resource was deleted',
      'Try refreshing the page',
    ],
    retryable: false,
  },
  RateLimitError: {
    message: 'Too many requests. Please try again later.',
    actions: [
      'Wait a few moments before trying again',
      'Reduce the frequency of requests',
      'Check your rate limit status',
    ],
    retryable: true,
    retryAfter: 60,
  },
  ServiceUnavailableError: {
    message: 'Service is temporarily unavailable.',
    actions: [
      'Try again in a few moments',
      'Check service status page',
      'Contact support if issue persists',
    ],
    retryable: true,
    retryAfter: 30,
  },
  NetworkError: {
    message: 'Network connection issue detected.',
    actions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Disable VPN if active',
    ],
    retryable: true,
    retryAfter: 5,
  },
  TimeoutError: {
    message: 'Request timed out.',
    actions: [
      'Try again with a simpler request',
      'Check your connection speed',
      'Reduce the amount of data being processed',
    ],
    retryable: true,
    retryAfter: 10,
  },
  DatabaseError: {
    message: 'Database connection issue.',
    actions: [
      'Try again in a moment',
      'Contact support if issue persists',
    ],
    retryable: true,
    retryAfter: 15,
  },
};

/**
 * Get recovery suggestions for an error
 */
function getRecoverySuggestions(error) {
  const errorName = error.name || error.constructor?.name || 'Error';
  const suggestion = recoverySuggestions[errorName] || {
    message: 'An unexpected error occurred. Please try again.',
    actions: [
      'Try refreshing the page',
      'Clear your browser cache',
      'Contact support if the issue persists',
    ],
    retryable: true,
    retryAfter: 30,
  };

  return {
    ...suggestion,
    errorType: errorName,
    errorCode: error.code,
    statusCode: error.statusCode || 500,
  };
}

/**
 * Check if error is recoverable
 */
function isRecoverable(error) {
  const suggestion = getRecoverySuggestions(error);
  return suggestion.retryable;
}

/**
 * Get retry delay for error
 */
function getRetryDelay(error) {
  const suggestion = getRecoverySuggestions(error);
  return suggestion.retryAfter || 30;
}

/**
 * Health check for services
 */
async function checkServiceHealth(serviceName, healthCheckFn) {
  try {
    const startTime = Date.now();
    await healthCheckFn();
    const responseTime = Date.now() - startTime;

    return {
      service: serviceName,
      healthy: true,
      responseTime,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.warn(`Service health check failed: ${serviceName}`, { error: error.message });
    return {
      service: serviceName,
      healthy: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * Automatic service recovery
 */
async function attemptServiceRecovery(serviceName, recoveryFn, maxAttempts = 3) {
  let attempts = 0;
  let lastError;

  while (attempts < maxAttempts) {
    try {
      await recoveryFn();
      logger.info(`Service recovery successful: ${serviceName}`, { attempts: attempts + 1 });
      return { success: true, attempts: attempts + 1 };
    } catch (error) {
      lastError = error;
      attempts++;
      if (attempts < maxAttempts) {
        const delay = Math.pow(2, attempts) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`Service recovery failed: ${serviceName}`, {
    attempts,
    error: lastError?.message,
  });

  return { success: false, attempts, error: lastError?.message };
}

/**
 * Error deduplication
 */
class ErrorDeduplicator {
  constructor() {
    this.errorCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate error fingerprint
   */
  generateFingerprint(error, context = {}) {
    const key = `${error.name}:${error.message}:${error.statusCode}:${context.path || ''}`;
    return key;
  }

  /**
   * Check if error is duplicate
   */
  isDuplicate(error, context = {}) {
    const fingerprint = this.generateFingerprint(error, context);
    const cached = this.errorCache.get(fingerprint);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      cached.count++;
      cached.lastOccurrence = new Date();
      return true;
    }

    this.errorCache.set(fingerprint, {
      count: 1,
      timestamp: Date.now(),
      firstOccurrence: new Date(),
      lastOccurrence: new Date(),
      error: {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
      },
    });

    return false;
  }

  /**
   * Get duplicate count
   */
  getDuplicateCount(error, context = {}) {
    const fingerprint = this.generateFingerprint(error, context);
    const cached = this.errorCache.get(fingerprint);
    return cached ? cached.count : 0;
  }

  /**
   * Clear old entries
   */
  clearOldEntries() {
    const now = Date.now();
    for (const [key, value] of this.errorCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.errorCache.delete(key);
      }
    }
  }
}

module.exports = {
  getRecoverySuggestions,
  isRecoverable,
  getRetryDelay,
  checkServiceHealth,
  attemptServiceRecovery,
  ErrorDeduplicator,
};

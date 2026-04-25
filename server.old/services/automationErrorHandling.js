// Automation Error Handling and Retry Logic

const logger = require('../utils/logger');

/**
 * Retry configuration for automation actions
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'TEMPORARY_ERROR',
    'RATE_LIMIT'
  ]
};

/**
 * Execute action with retry logic
 */
async function executeWithRetry(actionFn, context = {}, options = {}) {
  const {
    maxRetries = RETRY_CONFIG.maxRetries,
    initialDelay = RETRY_CONFIG.initialDelay,
    maxDelay = RETRY_CONFIG.maxDelay,
    backoffMultiplier = RETRY_CONFIG.backoffMultiplier,
    retryableErrors = RETRY_CONFIG.retryableErrors
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await actionFn(context);
      if (attempt > 0) {
        logger.info('Action succeeded after retry', {
          attempts: attempt + 1,
          context: context.ruleId || context.actionType
        });
      }
      return result;
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error, retryableErrors)) {
        logger.warn('Non-retryable error encountered', {
          error: error.message,
          context: context.ruleId || context.actionType
        });
        throw error;
      }

      // If last attempt, throw error
      if (attempt === maxRetries) {
        logger.error('Action failed after all retries', {
          attempts: attempt + 1,
          error: error.message,
          context: context.ruleId || context.actionType
        });
        throw error;
      }

      // Wait before retrying
      logger.warn('Action failed, retrying', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: error.message,
        context: context.ruleId || context.actionType
      });

      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error, retryableErrors) {
  const errorCode = error.code || error.name || '';
  const errorMessage = error.message || '';

  // Check error code
  if (retryableErrors.some(code => errorCode.includes(code))) {
    return true;
  }

  // Check error message for retryable patterns
  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /temporary/i,
    /rate limit/i,
    /too many requests/i
  ];

  return retryablePatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Error classification for better handling
 */
function classifyError(error) {
  const errorCode = error.code || error.name || '';
  const errorMessage = error.message || '';

  // Network errors
  if (errorCode.includes('ETIMEDOUT') || errorCode.includes('ECONNRESET') || errorCode.includes('ENOTFOUND')) {
    return {
      type: 'network_error',
      retryable: true,
      severity: 'medium'
    };
  }

  // Rate limiting
  if (errorCode.includes('RATE_LIMIT') || errorMessage.match(/rate limit|too many requests/i)) {
    return {
      type: 'rate_limit',
      retryable: true,
      severity: 'low',
      suggestedDelay: 5000
    };
  }

  // Validation errors
  if (errorCode.includes('VALIDATION') || errorMessage.match(/invalid|validation|required/i)) {
    return {
      type: 'validation_error',
      retryable: false,
      severity: 'high'
    };
  }

  // Permission errors
  if (errorCode.includes('PERMISSION') || errorCode.includes('FORBIDDEN') || errorCode.includes('UNAUTHORIZED')) {
    return {
      type: 'permission_error',
      retryable: false,
      severity: 'high'
    };
  }

  // Resource not found
  if (errorCode.includes('NOT_FOUND') || errorMessage.match(/not found/i)) {
    return {
      type: 'not_found',
      retryable: false,
      severity: 'medium'
    };
  }

  // Default
  return {
    type: 'unknown_error',
    retryable: false,
    severity: 'medium'
  };
}

/**
 * Enhanced error handler with classification and context
 */
function handleAutomationError(error, context = {}) {
  const classification = classifyError(error);
  const errorContext = {
    ...classification,
    error: {
      message: error.message,
      code: error.code || error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    },
    context: {
      ruleId: context.ruleId,
      actionType: context.actionType,
      contentId: context.contentId,
      userId: context.userId
    },
    timestamp: new Date()
  };

  // Log based on severity
  if (classification.severity === 'high') {
    logger.error('High severity automation error', errorContext);
  } else if (classification.severity === 'medium') {
    logger.warn('Medium severity automation error', errorContext);
  } else {
    logger.info('Low severity automation error', errorContext);
  }

  return errorContext;
}

/**
 * Circuit breaker for preventing repeated failures
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(actionFn, context = {}) {
    // Check circuit state
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN', { context });
      } else {
        throw new Error('Circuit breaker is OPEN - action temporarily disabled');
      }
    }

    try {
      const result = await actionFn(context);
      
      // Success - reset failure count
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 2) {
          this.state = 'CLOSED';
          this.failureCount = 0;
          logger.info('Circuit breaker closed after successful recovery', { context });
        }
      } else {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        logger.error('Circuit breaker opened due to repeated failures', {
          failureCount: this.failureCount,
          context
        });
      }

      throw error;
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Global circuit breakers per action type
const circuitBreakers = new Map();

/**
 * Get or create circuit breaker for action type
 */
function getCircuitBreaker(actionType) {
  if (!circuitBreakers.has(actionType)) {
    circuitBreakers.set(actionType, new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000
    }));
  }
  return circuitBreakers.get(actionType);
}

/**
 * Execute action with circuit breaker and retry
 */
async function executeWithCircuitBreakerAndRetry(actionFn, actionType, context = {}) {
  const circuitBreaker = getCircuitBreaker(actionType);

  return await circuitBreaker.execute(async (ctx) => {
    return await executeWithRetry(actionFn, ctx, {
      maxRetries: 3,
      initialDelay: 1000
    });
  }, context);
}

module.exports = {
  executeWithRetry,
  isRetryableError,
  classifyError,
  handleAutomationError,
  CircuitBreaker,
  getCircuitBreaker,
  executeWithCircuitBreakerAndRetry
};








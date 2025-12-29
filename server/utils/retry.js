// Retry utility with exponential backoff

const logger = require('./logger');
const { getRecoveryStrategy } = require('./errorCategorizer');

/**
 * Retry function with exponential backoff and error categorization
 */
async function retry(fn, options = {}) {
  let {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry = null,
    categorizeErrors = true,
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Categorize error and adjust strategy if enabled
      if (categorizeErrors && attempt === 0) {
        const strategy = getRecoveryStrategy(error);
        if (!strategy.retryable) {
          throw error; // Don't retry non-retryable errors
        }
        // Override options with strategy recommendations
        maxRetries = strategy.maxRetries || maxRetries;
        if (strategy.strategyDetails?.initialDelay) {
          initialDelay = strategy.strategyDetails.initialDelay;
        }
        if (strategy.strategyDetails?.maxDelay) {
          maxDelay = strategy.strategyDetails.maxDelay;
        }
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        initialDelay * Math.pow(factor, attempt),
        maxDelay
      );

      // Add jitter if specified
      if (options.jitter) {
        delay = delay + Math.random() * delay * 0.1;
      }

      logger.warn('Retry attempt', {
        attempt: attempt + 1,
        maxRetries,
        delay: Math.round(delay),
        error: error.message,
        category: categorizeErrors ? getRecoveryStrategy(error).category : 'unknown',
      });

      if (onRetry) {
        await onRetry(error, attempt + 1, delay);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Retry with circuit breaker pattern
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    // Check if circuit should be reset
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker: Moving to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      
      // Reset on success
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        logger.info('Circuit breaker: Moving to CLOSED state');
      } else {
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        logger.error('Circuit breaker: Moving to OPEN state', {
          failures: this.failures,
        });
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Retry with jitter (randomized delay)
 */
async function retryWithJitter(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = true,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with jitter
      let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      if (jitter) {
        delay = delay + Math.random() * delay * 0.1; // Add 10% jitter
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  retry,
  retryWithJitter,
  CircuitBreaker,
};

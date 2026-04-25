// Retry Utility with Exponential Backoff

const logger = require('./logger');
const { AppError } = require('./errorHandler');

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff(
  fn,
  options = {}
) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    retryableErrors = [],
    onRetry = null,
  } = options;

  let lastError;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      // Don't retry on client errors (4xx) unless specified
      if (error instanceof AppError && error.statusCode < 500) {
        if (!retryableErrors.includes(error.statusCode)) {
          throw error;
        }
      }

      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt - 1),
        maxDelay
      );

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, delay, error);
      }

      logger.warn(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`, {
        error: error.message,
        attempt,
      });

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  logger.error('All retry attempts exhausted', {
    error: lastError?.message,
    attempts: attempt,
  });

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
        logger.info('Circuit breaker entering HALF_OPEN state');
      } else {
        throw new AppError('Circuit breaker is OPEN. Service unavailable.', 503);
      }
    }

    try {
      const result = await fn();
      
      // Success - reset failures if in HALF_OPEN
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        logger.info('Circuit breaker CLOSED - service recovered');
      } else if (this.state === 'CLOSED') {
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      // Open circuit if threshold exceeded
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        logger.error('Circuit breaker OPEN - too many failures', {
          failures: this.failures,
          threshold: this.failureThreshold,
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
    logger.info('Circuit breaker manually reset');
  }
}

module.exports = {
  retryWithBackoff,
  CircuitBreaker,
};







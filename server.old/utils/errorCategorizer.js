// Error categorization and recovery strategies

const logger = require('./logger');

/**
 * Categorize error for appropriate recovery strategy
 */
function categorizeError(error) {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code;

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ECONNREFUSED'
  ) {
    return {
      category: 'network',
      retryable: true,
      maxRetries: 5,
      strategy: 'exponential_backoff',
      severity: 'medium',
    };
  }

  // Rate limit errors
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorCode === 429
  ) {
    return {
      category: 'rate_limit',
      retryable: true,
      maxRetries: 3,
      strategy: 'exponential_backoff_with_jitter',
      severity: 'low',
      delay: 60000, // Wait 1 minute
    };
  }

  // Authentication errors
  if (
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('token') ||
    errorCode === 401
  ) {
    return {
      category: 'authentication',
      retryable: false,
      strategy: 'refresh_token',
      severity: 'high',
    };
  }

  // Validation errors
  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('invalid') ||
    errorCode === 400
  ) {
    return {
      category: 'validation',
      retryable: false,
      strategy: 'fix_input',
      severity: 'low',
    };
  }

  // Server errors
  if (
    errorMessage.includes('server error') ||
    errorMessage.includes('internal error') ||
    errorCode >= 500
  ) {
    return {
      category: 'server_error',
      retryable: true,
      maxRetries: 3,
      strategy: 'exponential_backoff',
      severity: 'high',
    };
  }

  // Database errors
  if (
    errorMessage.includes('database') ||
    errorMessage.includes('mongodb') ||
    errorMessage.includes('connection')
  ) {
    return {
      category: 'database',
      retryable: true,
      maxRetries: 3,
      strategy: 'exponential_backoff',
      severity: 'critical',
    };
  }

  // Default
  return {
    category: 'unknown',
    retryable: false,
    strategy: 'log_and_fail',
    severity: 'medium',
  };
}

/**
 * Get recovery strategy for error
 */
function getRecoveryStrategy(error) {
  const categorization = categorizeError(error);
  
  const strategies = {
    exponential_backoff: {
      initialDelay: 1000,
      maxDelay: 30000,
      factor: 2,
    },
    exponential_backoff_with_jitter: {
      initialDelay: categorization.delay || 1000,
      maxDelay: 60000,
      factor: 2,
      jitter: true,
    },
    refresh_token: {
      action: 'refresh_authentication',
    },
    fix_input: {
      action: 'validate_and_fix',
    },
    log_and_fail: {
      action: 'log_error',
    },
  };

  return {
    ...categorization,
    strategyDetails: strategies[categorization.strategy] || strategies.log_and_fail,
  };
}

module.exports = {
  categorizeError,
  getRecoveryStrategy,
};







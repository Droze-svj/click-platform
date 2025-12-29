// Free AI Model Rate Limiter
// Manages rate limits and usage tracking for free AI providers

const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

// In-memory rate limit tracking (in production, use Redis)
const rateLimitStore = new Map();

/**
 * Check if request is within rate limits
 */
function checkRateLimit(provider, options = {}) {
  const { FREE_AI_PROVIDERS } = require('./freeAIModelService');
  const providerConfig = FREE_AI_PROVIDERS[provider];
  if (!providerConfig) {
    throw new AppError(`Provider '${provider}' not found`, 400);
  }

  const limits = providerConfig.freeTier;
  const now = Date.now();
  const key = `ratelimit:${provider}`;

  // Get current usage
  let usage = rateLimitStore.get(key) || {
    count: 0,
    tokens: 0,
    resetAt: getResetTime(provider),
    requests: [],
  };

  // Reset if past reset time
  if (now > usage.resetAt) {
    usage = {
      count: 0,
      tokens: 0,
      resetAt: getResetTime(provider),
      requests: [],
    };
  }

  // Check limits
  const canMakeRequest = checkLimits(usage, limits, options);

  if (!canMakeRequest.allowed) {
    const retryAfter = Math.ceil((usage.resetAt - now) / 1000);
    throw new AppError(
      `Rate limit exceeded for ${providerConfig.name}. ${canMakeRequest.reason}. Retry after ${retryAfter} seconds.`,
      429,
      {
        retryAfter,
        resetAt: usage.resetAt,
        limits,
        current: {
          requests: usage.count,
          tokens: usage.tokens,
        },
      }
    );
  }

  return {
    allowed: true,
    remaining: {
      requests: limits.requestsPerDay ? limits.requestsPerDay - usage.count : null,
      tokens: limits.tokensPerDay ? limits.tokensPerDay - usage.tokens : null,
    },
    resetAt: usage.resetAt,
  };
}

/**
 * Record API usage
 */
function recordUsage(provider, tokens = 0) {
  const key = `ratelimit:${provider}`;
  let usage = rateLimitStore.get(key) || {
    count: 0,
    tokens: 0,
    resetAt: getResetTime(provider),
    requests: [],
  };

  usage.count += 1;
  usage.tokens += tokens;
  usage.requests.push({
    timestamp: Date.now(),
    tokens,
  });

  // Keep only last 100 requests
  if (usage.requests.length > 100) {
    usage.requests = usage.requests.slice(-100);
  }

  rateLimitStore.set(key, usage);

  logger.debug('API usage recorded', {
    provider,
    count: usage.count,
    tokens: usage.tokens,
  });
}

/**
 * Check if usage is within limits
 */
function checkLimits(usage, limits, options = {}) {
  // Check request limit
  if (limits.requestsPerDay && usage.count >= limits.requestsPerDay) {
    return {
      allowed: false,
      reason: `Daily request limit (${limits.requestsPerDay}) reached`,
    };
  }

  // Check token limit
  if (limits.tokensPerDay && usage.tokens >= limits.tokensPerDay) {
    return {
      allowed: false,
      reason: `Daily token limit (${limits.tokensPerDay}) reached`,
    };
  }

  // Check per-minute rate limit
  if (limits.requestsPerMinute) {
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = usage.requests.filter(
      req => req.timestamp > oneMinuteAgo
    ).length;

    if (recentRequests >= limits.requestsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit (${limits.requestsPerMinute} requests/minute) exceeded`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Get reset time for provider
 */
function getResetTime(provider) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * Get current usage for provider
 */
function getUsage(provider) {
  const key = `ratelimit:${provider}`;
  const usage = rateLimitStore.get(key) || {
    count: 0,
    tokens: 0,
    resetAt: getResetTime(provider),
    requests: [],
  };

  const providerConfig = FREE_AI_PROVIDERS[provider];
  const limits = providerConfig?.freeTier || {};

  return {
    provider,
    usage: {
      requests: usage.count,
      tokens: usage.tokens,
    },
    limits: {
      requestsPerDay: limits.requestsPerDay || null,
      tokensPerDay: limits.tokensPerDay || null,
      requestsPerMinute: limits.requestsPerMinute || null,
    },
    remaining: {
      requests: limits.requestsPerDay
        ? Math.max(0, limits.requestsPerDay - usage.count)
        : null,
      tokens: limits.tokensPerDay
        ? Math.max(0, limits.tokensPerDay - usage.tokens)
        : null,
    },
    resetAt: new Date(usage.resetAt),
    resetIn: Math.ceil((usage.resetAt - Date.now()) / 1000), // seconds
  };
}

/**
 * Get usage for all providers
 */
function getAllUsage() {
  const usage = {};
  const { FREE_AI_PROVIDERS } = require('./freeAIModelService');

  if (!FREE_AI_PROVIDERS) {
    return {};
  }

  for (const provider of Object.keys(FREE_AI_PROVIDERS)) {
    try {
      usage[provider] = getUsage(provider);
    } catch (error) {
      logger.warn('Error getting usage for provider', { provider, error: error.message });
      usage[provider] = {
        provider,
        usage: { requests: 0, tokens: 0 },
        limits: {},
        remaining: {},
        resetAt: new Date(),
        resetIn: 0,
      };
    }
  }

  return usage;
}

/**
 * Reset usage for provider (for testing)
 */
function resetUsage(provider) {
  const key = `ratelimit:${provider}`;
  rateLimitStore.delete(key);
  logger.info(`Usage reset for ${provider}`);
}

/**
 * Reset all usage (for testing)
 */
function resetAllUsage() {
  rateLimitStore.clear();
  logger.info('All usage reset');
}

module.exports = {
  checkRateLimit,
  recordUsage,
  getUsage,
  getAllUsage,
  resetUsage,
  resetAllUsage,
};


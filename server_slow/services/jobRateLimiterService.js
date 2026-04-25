// Job Rate Limiter Service
// Per-user rate limiting for jobs

const logger = require('../utils/logger');
const { getQueue, addJob } = require('./jobQueueService');

// In-memory rate limit tracking (could use Redis in production)
const userRateLimits = new Map();

/**
 * Check if user can add job (rate limit)
 */
function checkUserRateLimit(userId, queueName, limits = {}) {
  const key = `${userId}:${queueName}`;
  const now = Date.now();
  
  // Default limits per queue
  const defaultLimits = {
    'video-processing': { max: 10, window: 3600000 }, // 10 per hour
    'content-generation': { max: 50, window: 3600000 }, // 50 per hour
    'transcript-generation': { max: 20, window: 3600000 }, // 20 per hour
    'social-posting': { max: 100, window: 3600000 }, // 100 per hour
    'email-sending': { max: 200, window: 3600000 }, // 200 per hour
  };

  const limit = limits[queueName] || defaultLimits[queueName] || { max: 100, window: 3600000 };
  
  if (!userRateLimits.has(key)) {
    userRateLimits.set(key, {
      count: 0,
      resetAt: now + limit.window,
    });
  }

  const userLimit = userRateLimits.get(key);

  // Reset if window expired
  if (now > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = now + limit.window;
  }

  // Check if limit exceeded
  if (userLimit.count >= limit.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: userLimit.resetAt,
    };
  }

  // Increment count
  userLimit.count++;

  return {
    allowed: true,
    remaining: limit.max - userLimit.count,
    resetAt: userLimit.resetAt,
  };
}

/**
 * Add job with rate limiting
 */
async function addJobWithRateLimit(queueName, jobData, userId, options = {}) {
  const rateLimit = checkUserRateLimit(userId, queueName, options.rateLimits);

  if (!rateLimit.allowed) {
    throw new Error(`Rate limit exceeded. Try again after ${new Date(rateLimit.resetAt).toISOString()}`);
  }

  // Add user ID to job data if not present
  if (!jobData.data.userId && !jobData.data.user) {
    jobData.data.userId = userId;
  }

  const job = await addJob(queueName, jobData, options);

  logger.debug('Job added with rate limit check', {
    queue: queueName,
    userId,
    remaining: rateLimit.remaining,
  });

  return {
    job,
    rateLimit: {
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
    },
  };
}

/**
 * Get user rate limit status
 */
function getUserRateLimitStatus(userId, queueName) {
  const key = `${userId}:${queueName}`;
  
  if (!userRateLimits.has(key)) {
    return {
      count: 0,
      limit: 100, // Default
      remaining: 100,
    };
  }

  const userLimit = userRateLimits.get(key);
  const now = Date.now();

  if (now > userLimit.resetAt) {
    return {
      count: 0,
      limit: 100,
      remaining: 100,
      resetAt: userLimit.resetAt,
    };
  }

  return {
    count: userLimit.count,
    limit: 100, // Would need to store this
    remaining: 100 - userLimit.count,
    resetAt: userLimit.resetAt,
  };
}

/**
 * Reset user rate limit (admin function)
 */
function resetUserRateLimit(userId, queueName = null) {
  if (queueName) {
    const key = `${userId}:${queueName}`;
    userRateLimits.delete(key);
  } else {
    // Reset all queues for user
    for (const key of userRateLimits.keys()) {
      if (key.startsWith(`${userId}:`)) {
        userRateLimits.delete(key);
      }
    }
  }
}

module.exports = {
  checkUserRateLimit,
  addJobWithRateLimit,
  getUserRateLimitStatus,
  resetUserRateLimit,
};




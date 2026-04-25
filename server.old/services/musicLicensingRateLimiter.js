// Music Licensing Rate Limiter
// Manages API rate limits and quotas for music providers

const logger = require('../utils/logger');
const MusicProviderConfig = require('../models/MusicProviderConfig');

/**
 * Rate limit tracker per provider
 */
const rateLimitTrackers = new Map();

/**
 * Initialize rate limit tracker for provider
 */
function initializeRateLimiter(provider, config) {
  if (!rateLimitTrackers.has(provider)) {
    rateLimitTrackers.set(provider, {
      requests: [],
      quota: {
        requestsPerMinute: config.rateLimit?.requestsPerMinute || 60,
        requestsPerDay: config.rateLimit?.requestsPerDay || 10000,
        requestsPerHour: config.rateLimit?.requestsPerHour || 1000
      },
      dailyCount: 0,
      dailyReset: new Date(),
      hourlyCount: 0,
      hourlyReset: new Date()
    });
  }
  return rateLimitTrackers.get(provider);
}

/**
 * Check if request is within rate limits
 */
async function checkRateLimit(provider) {
  const config = await MusicProviderConfig.findOne({ provider }).lean();
  if (!config) {
    throw new Error(`Provider ${provider} not configured`);
  }

  const tracker = initializeRateLimiter(provider, config);
  const now = new Date();

  // Reset daily counter if needed
  if (now.getDate() !== tracker.dailyReset.getDate()) {
    tracker.dailyCount = 0;
    tracker.dailyReset = now;
  }

  // Reset hourly counter if needed
  if (now.getHours() !== tracker.hourlyReset.getHours()) {
    tracker.hourlyCount = 0;
    tracker.hourlyReset = now;
  }

  // Check daily limit
  if (tracker.dailyCount >= tracker.quota.requestsPerDay) {
    const resetTime = new Date(tracker.dailyReset);
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);
    
    throw new Error(`Daily rate limit exceeded. Resets at ${resetTime.toISOString()}`);
  }

  // Check hourly limit
  if (tracker.hourlyCount >= tracker.quota.requestsPerHour) {
    const resetTime = new Date(tracker.hourlyReset);
    resetTime.setHours(resetTime.getHours() + 1);
    resetTime.setMinutes(0, 0, 0);
    
    throw new Error(`Hourly rate limit exceeded. Resets at ${resetTime.toISOString()}`);
  }

  // Check per-minute limit
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  const recentRequests = tracker.requests.filter(time => time > oneMinuteAgo);
  
  if (recentRequests.length >= tracker.quota.requestsPerMinute) {
    const oldestRequest = recentRequests[0];
    const waitTime = 60000 - (now.getTime() - oldestRequest.getTime());
    
    throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)} seconds`);
  }

  return true;
}

/**
 * Record API request
 */
function recordRequest(provider) {
  const tracker = rateLimitTrackers.get(provider);
  if (tracker) {
    const now = new Date();
    tracker.requests.push(now);
    tracker.dailyCount++;
    tracker.hourlyCount++;

    // Keep only last minute of requests
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    tracker.requests = tracker.requests.filter(time => time > oneMinuteAgo);
  }
}

/**
 * Get rate limit status for provider
 */
function getRateLimitStatus(provider) {
  const tracker = rateLimitTrackers.get(provider);
  if (!tracker) {
    return null;
  }

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  const recentRequests = tracker.requests.filter(time => time > oneMinuteAgo);

  return {
    provider,
    quota: tracker.quota,
    usage: {
      perMinute: recentRequests.length,
      perHour: tracker.hourlyCount,
      perDay: tracker.dailyCount
    },
    remaining: {
      perMinute: Math.max(0, tracker.quota.requestsPerMinute - recentRequests.length),
      perHour: Math.max(0, tracker.quota.requestsPerHour - tracker.hourlyCount),
      perDay: Math.max(0, tracker.quota.requestsPerDay - tracker.dailyCount)
    },
    resetTimes: {
      hourly: tracker.hourlyReset,
      daily: tracker.dailyReset
    }
  };
}

/**
 * Wait if rate limit is approaching
 */
async function waitIfNeeded(provider) {
  const tracker = rateLimitTrackers.get(provider);
  if (!tracker) return;

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  const recentRequests = tracker.requests.filter(time => time > oneMinuteAgo);

  // If we're at 80% of limit, slow down
  const threshold = tracker.quota.requestsPerMinute * 0.8;
  if (recentRequests.length >= threshold) {
    const waitTime = 1000; // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

/**
 * Wrapper for provider API calls with rate limiting
 */
async function rateLimitedApiCall(provider, apiCall) {
  await checkRateLimit(provider);
  await waitIfNeeded(provider);
  
  try {
    const result = await apiCall();
    recordRequest(provider);
    return result;
  } catch (error) {
    // Don't record failed requests against rate limit if it's a rate limit error
    if (!error.message.includes('rate limit') && !error.message.includes('Rate limit')) {
      recordRequest(provider);
    }
    throw error;
  }
}

module.exports = {
  checkRateLimit,
  recordRequest,
  getRateLimitStatus,
  waitIfNeeded,
  rateLimitedApiCall
};








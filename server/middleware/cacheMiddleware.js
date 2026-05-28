// Cache middleware for API responses

const cacheService = require('../services/cacheService');

/**
 * Cache middleware that delegates to the robust Redis-backed cacheService
 * @param {number} ttl Time to live in seconds
 */
function cacheMiddleware(ttl = 300) { // 5 minutes default (in seconds for Redis)
  return cacheService.cacheMiddleware(ttl);
}

/**
 * Invalidate cache for specific patterns
 */
async function invalidateCache(pattern) {
  return cacheService.delPattern(pattern);
}

module.exports = {
  cacheMiddleware,
  invalidateCache
};








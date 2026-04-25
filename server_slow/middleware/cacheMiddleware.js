// Cache middleware for API responses

const cache = require('../utils/cache');
const crypto = require('crypto');

/**
 * Generate cache key from request
 */
function generateCacheKey(req) {
  const keyData = {
    path: req.path,
    query: req.query,
    user: req.user?._id?.toString()
  };
  const keyString = JSON.stringify(keyData);
  return crypto.createHash('md5').update(keyString).digest('hex');
}

/**
 * Cache middleware
 */
function cacheMiddleware(ttl = 300000) { // 5 minutes default
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache for authenticated routes that need fresh data
    if (req.path.includes('/auth/me') || req.path.includes('/status')) {
      return next();
    }

    const cacheKey = `api:${generateCacheKey(req)}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate cache for specific patterns
 */
function invalidateCache(pattern) {
  // Simple pattern matching - in production, use Redis with pattern matching
  const cache = require('../utils/cache');
  // For now, we'll need to track keys or clear all
  // In production, use Redis with pattern deletion
}

module.exports = {
  cacheMiddleware,
  invalidateCache
};








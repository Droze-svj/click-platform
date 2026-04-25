// Response caching middleware

const { getCachedContent, cacheContent, generateCacheKey } = require('../services/performanceOptimizationService');
const logger = require('../utils/logger');

/**
 * Cache response middleware
 */
function cacheResponse(ttl = 300) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache for authenticated user-specific data
    if (req.user && req.path.includes('/user')) {
      return next();
    }

    try {
      const cacheKey = generateCacheKey(req.path, {
        ...req.query,
        userId: req.user?._id?.toString() || 'anonymous'
      });

      const cached = getCachedContent(cacheKey);
      if (cached) {
        logger.info('Cache hit', { path: req.path, cacheKey });
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data) {
        cacheContent(cacheKey, data);
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', { error: error.message });
      next();
    }
  };
}

module.exports = { cacheResponse };








// Performance optimization service

const LRUCache = require('lru-cache');
const logger = require('../utils/logger');

// In-memory caches
const contentCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true
});

const searchCache = new LRUCache({
  max: 200,
  ttl: 1000 * 60 * 2, // 2 minutes
  updateAgeOnGet: true
});

const analyticsCache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 10, // 10 minutes
  updateAgeOnGet: true
});

/**
 * Cache content data
 */
function cacheContent(key, data) {
  try {
    contentCache.set(key, data);
    return true;
  } catch (error) {
    logger.error('Error caching content', { error: error.message, key });
    return false;
  }
}

/**
 * Get cached content
 */
function getCachedContent(key) {
  try {
    return contentCache.get(key) || null;
  } catch (error) {
    logger.error('Error getting cached content', { error: error.message, key });
    return null;
  }
}

/**
 * Cache search results
 */
function cacheSearch(key, results) {
  try {
    searchCache.set(key, results);
    return true;
  } catch (error) {
    logger.error('Error caching search', { error: error.message, key });
    return false;
  }
}

/**
 * Get cached search results
 */
function getCachedSearch(key) {
  try {
    return searchCache.get(key) || null;
  } catch (error) {
    logger.error('Error getting cached search', { error: error.message, key });
    return null;
  }
}

/**
 * Cache analytics data
 */
function cacheAnalytics(key, data) {
  try {
    analyticsCache.set(key, data);
    return true;
  } catch (error) {
    logger.error('Error caching analytics', { error: error.message, key });
    return false;
  }
}

/**
 * Get cached analytics
 */
function getCachedAnalytics(key) {
  try {
    return analyticsCache.get(key) || null;
  } catch (error) {
    logger.error('Error getting cached analytics', { error: error.message, key });
    return null;
  }
}

/**
 * Clear all caches
 */
function clearAllCaches() {
  try {
    contentCache.clear();
    searchCache.clear();
    analyticsCache.clear();
    logger.info('All caches cleared');
    return true;
  } catch (error) {
    logger.error('Error clearing caches', { error: error.message });
    return false;
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  try {
    return {
      content: {
        size: contentCache.size,
        max: contentCache.max,
        hitRate: contentCache.hits / (contentCache.hits + contentCache.misses) || 0
      },
      search: {
        size: searchCache.size,
        max: searchCache.max,
        hitRate: searchCache.hits / (searchCache.hits + searchCache.misses) || 0
      },
      analytics: {
        size: analyticsCache.size,
        max: analyticsCache.max,
        hitRate: analyticsCache.hits / (analyticsCache.hits + analyticsCache.misses) || 0
      }
    };
  } catch (error) {
    logger.error('Error getting cache stats', { error: error.message });
    return null;
  }
}

/**
 * Generate cache key from parameters
 */
function generateCacheKey(prefix, params) {
  try {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  } catch (error) {
    logger.error('Error generating cache key', { error: error.message });
    return `${prefix}:${Date.now()}`;
  }
}

module.exports = {
  cacheContent,
  getCachedContent,
  cacheSearch,
  getCachedSearch,
  cacheAnalytics,
  getCachedAnalytics,
  clearAllCaches,
  getCacheStats,
  generateCacheKey
};








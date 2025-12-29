// Music Licensing Cache Service
// Caches track searches, details, and license validations

const logger = require('../utils/logger');

// Simple in-memory cache implementation
class SimpleCache {
  constructor(ttl = 3600000) {
    this.cache = new Map();
    this.ttl = ttl;
    this.stats = { hits: 0, misses: 0 };
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return undefined;
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return item.value;
  }

  del(key) {
    this.cache.delete(key);
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  flushAll() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  getStats() {
    return this.stats;
  }
}

// Cache instances
const trackSearchCache = new SimpleCache(3600000); // 1 hour
const trackDetailsCache = new SimpleCache(7200000); // 2 hours
const licenseValidationCache = new SimpleCache(86400000); // 24 hours

/**
 * Generate cache key for track search
 */
function getSearchCacheKey(provider, query, filters) {
  const filterStr = JSON.stringify(filters || {});
  return `search:${provider}:${query}:${filterStr}`;
}

/**
 * Cache track search results
 */
function cacheTrackSearch(provider, query, filters, results) {
  const key = getSearchCacheKey(provider, query, filters);
  trackSearchCache.set(key, results);
  logger.debug('Track search cached', { provider, query, resultCount: results.length });
}

/**
 * Get cached track search results
 */
function getCachedTrackSearch(provider, query, filters) {
  const key = getSearchCacheKey(provider, query, filters);
  const cached = trackSearchCache.get(key);
  if (cached) {
    logger.debug('Track search cache hit', { provider, query });
  }
  return cached;
}

/**
 * Generate cache key for track details
 */
function getTrackDetailsCacheKey(provider, trackId) {
  return `track:${provider}:${trackId}`;
}

/**
 * Cache track details
 */
function cacheTrackDetails(provider, trackId, details) {
  const key = getTrackDetailsCacheKey(provider, trackId);
  trackDetailsCache.set(key, details);
  logger.debug('Track details cached', { provider, trackId });
}

/**
 * Get cached track details
 */
function getCachedTrackDetails(provider, trackId) {
  const key = getTrackDetailsCacheKey(provider, trackId);
  const cached = trackDetailsCache.get(key);
  if (cached) {
    logger.debug('Track details cache hit', { provider, trackId });
  }
  return cached;
}

/**
 * Generate cache key for license validation
 */
function getLicenseValidationCacheKey(provider, trackId) {
  return `license:${provider}:${trackId}`;
}

/**
 * Cache license validation result
 */
function cacheLicenseValidation(provider, trackId, validation) {
  const key = getLicenseValidationCacheKey(provider, trackId);
  licenseValidationCache.set(key, validation);
  logger.debug('License validation cached', { provider, trackId });
}

/**
 * Get cached license validation
 */
function getCachedLicenseValidation(provider, trackId) {
  const key = getLicenseValidationCacheKey(provider, trackId);
  const cached = licenseValidationCache.get(key);
  if (cached) {
    logger.debug('License validation cache hit', { provider, trackId });
  }
  return cached;
}

/**
 * Invalidate cache for a track
 */
function invalidateTrackCache(provider, trackId) {
  const detailsKey = getTrackDetailsCacheKey(provider, trackId);
  const licenseKey = getLicenseValidationCacheKey(provider, trackId);
  
  trackDetailsCache.del(detailsKey);
  licenseValidationCache.del(licenseKey);
  
  logger.debug('Track cache invalidated', { provider, trackId });
}

/**
 * Invalidate all search caches for a provider
 */
function invalidateProviderSearchCache(provider) {
  const keys = trackSearchCache.keys();
  keys.forEach(key => {
    if (key.startsWith(`search:${provider}:`)) {
      trackSearchCache.del(key);
    }
  });
  logger.debug('Provider search cache invalidated', { provider });
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    trackSearch: {
      keys: trackSearchCache.keys().length,
      hits: trackSearchCache.getStats().hits || 0,
      misses: trackSearchCache.getStats().misses || 0
    },
    trackDetails: {
      keys: trackDetailsCache.keys().length,
      hits: trackDetailsCache.getStats().hits || 0,
      misses: trackDetailsCache.getStats().misses || 0
    },
    licenseValidation: {
      keys: licenseValidationCache.keys().length,
      hits: licenseValidationCache.getStats().hits || 0,
      misses: licenseValidationCache.getStats().misses || 0
    }
  };
}

/**
 * Clear all caches
 */
function clearAllCaches() {
  trackSearchCache.flushAll();
  trackDetailsCache.flushAll();
  licenseValidationCache.flushAll();
  logger.info('All music licensing caches cleared');
}

module.exports = {
  cacheTrackSearch,
  getCachedTrackSearch,
  cacheTrackDetails,
  getCachedTrackDetails,
  cacheLicenseValidation,
  getCachedLicenseValidation,
  invalidateTrackCache,
  invalidateProviderSearchCache,
  getCacheStats,
  clearAllCaches
};


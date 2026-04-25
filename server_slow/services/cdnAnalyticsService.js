// CDN Analytics Service

const { getOrSet, set, get } = require('./cacheService');
const logger = require('../utils/logger');

// CDN analytics storage
const analytics = {
  cacheHits: 0,
  cacheMisses: 0,
  purges: 0,
  bandwidth: 0,
  requests: {
    byRegion: {},
    byPath: {},
    byStatus: {},
  },
};

/**
 * Record cache hit
 */
function recordCacheHit(path) {
  analytics.cacheHits++;
  recordPathRequest(path, true);
}

/**
 * Record cache miss
 */
function recordCacheMiss(path) {
  analytics.cacheMisses++;
  recordPathRequest(path, false);
}

/**
 * Record path request
 */
function recordPathRequest(path, hit) {
  if (!analytics.requests.byPath[path]) {
    analytics.requests.byPath[path] = {
      hits: 0,
      misses: 0,
      total: 0,
    };
  }

  analytics.requests.byPath[path].total++;
  if (hit) {
    analytics.requests.byPath[path].hits++;
  } else {
    analytics.requests.byPath[path].misses++;
  }
}

/**
 * Record purge
 */
function recordPurge(paths) {
  analytics.purges++;
  logger.info('CDN purge recorded', { paths: paths.length });
}

/**
 * Record bandwidth
 */
function recordBandwidth(bytes) {
  analytics.bandwidth += bytes;
}

/**
 * Record request by region
 */
function recordRegionRequest(region, path) {
  if (!analytics.requests.byRegion[region]) {
    analytics.requests.byRegion[region] = {
      count: 0,
      paths: {},
    };
  }

  analytics.requests.byRegion[region].count++;
  if (!analytics.requests.byRegion[region].paths[path]) {
    analytics.requests.byRegion[region].paths[path] = 0;
  }
  analytics.requests.byRegion[region].paths[path]++;
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const total = analytics.cacheHits + analytics.cacheMisses;
  const hitRate = total > 0 ? (analytics.cacheHits / total) * 100 : 0;

  return {
    hits: analytics.cacheHits,
    misses: analytics.cacheMisses,
    total,
    hitRate: Math.round(hitRate * 100) / 100,
    purges: analytics.purges,
    bandwidth: analytics.bandwidth,
    bandwidthGB: Math.round((analytics.bandwidth / (1024 * 1024 * 1024)) * 100) / 100,
  };
}

/**
 * Get path statistics
 */
function getPathStats(limit = 20) {
  const paths = Object.entries(analytics.requests.byPath)
    .map(([path, stats]) => ({
      path,
      ...stats,
      hitRate: stats.total > 0 ? (stats.hits / stats.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return paths;
}

/**
 * Get region statistics
 */
function getRegionStats() {
  return Object.entries(analytics.requests.byRegion)
    .map(([region, stats]) => ({
      region,
      count: stats.count,
      topPaths: Object.entries(stats.paths)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, count]) => ({ path, count })),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get analytics summary
 */
function getAnalyticsSummary() {
  return {
    cache: getCacheStats(),
    topPaths: getPathStats(10),
    regions: getRegionStats(),
  };
}

/**
 * Reset analytics
 */
function resetAnalytics() {
  analytics.cacheHits = 0;
  analytics.cacheMisses = 0;
  analytics.purges = 0;
  analytics.bandwidth = 0;
  analytics.requests = {
    byRegion: {},
    byPath: {},
    byStatus: {},
  };
  logger.info('CDN analytics reset');
}

module.exports = {
  recordCacheHit,
  recordCacheMiss,
  recordPurge,
  recordBandwidth,
  recordRegionRequest,
  getCacheStats,
  getPathStats,
  getRegionStats,
  getAnalyticsSummary,
  resetAnalytics,
};







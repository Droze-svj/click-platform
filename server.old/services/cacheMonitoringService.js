// Cache Monitoring Service

const { get, set, del } = require('./cacheService');
const logger = require('../utils/logger');

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
  byKey: {},
  hitRate: 0,
};

/**
 * Monitor cache operations
 */
async function trackCacheHit(key) {
  cacheStats.hits++;
  cacheStats.byKey[key] = (cacheStats.byKey[key] || { hits: 0, misses: 0 });
  cacheStats.byKey[key].hits++;
  updateHitRate();
}

async function trackCacheMiss(key) {
  cacheStats.misses++;
  cacheStats.byKey[key] = (cacheStats.byKey[key] || { hits: 0, misses: 0 });
  cacheStats.byKey[key].misses++;
  updateHitRate();
}

async function trackCacheSet(key) {
  cacheStats.sets++;
}

async function trackCacheDelete(key) {
  cacheStats.deletes++;
}

async function trackCacheError(error) {
  cacheStats.errors++;
  logger.error('Cache error', { error: error.message });
}

/**
 * Update hit rate
 */
function updateHitRate() {
  const total = cacheStats.hits + cacheStats.misses;
  cacheStats.hitRate = total > 0 ? (cacheStats.hits / total) * 100 : 0;
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    ...cacheStats,
    total: cacheStats.hits + cacheStats.misses,
    hitRate: Math.round(cacheStats.hitRate * 100) / 100,
    topKeys: Object.entries(cacheStats.byKey)
      .sort((a, b) => (b[1].hits + b[1].misses) - (a[1].hits + a[1].misses))
      .slice(0, 10)
      .map(([key, stats]) => ({
        key,
        hits: stats.hits,
        misses: stats.misses,
        total: stats.hits + stats.misses,
        hitRate: stats.hits + stats.misses > 0 
          ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100 * 100) / 100 
          : 0,
      })),
  };
}

/**
 * Check Redis connection
 */
async function checkRedisConnection() {
  try {
    const start = Date.now();
    await get('health-check');
    const latency = Date.now() - start;
    
    return {
      connected: true,
      latency: `${latency}ms`,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * Get cache size (if available)
 */
async function getCacheSize() {
  try {
    // Try to get Redis info
    const redis = require('redis');
    if (process.env.REDIS_URL) {
      const client = redis.createClient({ url: process.env.REDIS_URL });
      await client.connect();
      const info = await client.info('memory');
      await client.quit();
      
      // Parse Redis memory info
      const usedMemory = info.match(/used_memory:(\d+)/)?.[1];
      const usedMemoryHuman = info.match(/used_memory_human:([^\r\n]+)/)?.[1];
      
      return {
        usedMemory: usedMemory ? parseInt(usedMemory) : null,
        usedMemoryHuman: usedMemoryHuman || null,
      };
    }
    
    return { error: 'Redis not configured' };
  } catch (error) {
    logger.error('Get cache size error', { error: error.message });
    return { error: error.message };
  }
}

/**
 * Reset statistics
 */
function resetStats() {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.sets = 0;
  cacheStats.deletes = 0;
  cacheStats.errors = 0;
  cacheStats.byKey = {};
  cacheStats.hitRate = 0;
  logger.info('Cache statistics reset');
}

module.exports = {
  trackCacheHit,
  trackCacheMiss,
  trackCacheSet,
  trackCacheDelete,
  trackCacheError,
  getCacheStats,
  checkRedisConnection,
  getCacheSize,
  resetStats,
};





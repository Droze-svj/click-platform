// Intelligent Caching Service

const { getOrSet, set, get, del } = require('./cacheService');
const logger = require('../utils/logger');
const {
  AppError,
  recoveryStrategies,
} = require('../utils/errorHandler');

/**
 * Multi-layer cache with intelligent invalidation
 */
class IntelligentCache {
  constructor() {
    this.l1Cache = new Map(); // In-memory (fastest)
    this.l2Cache = null; // Redis (fast)
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
    this.dependencies = new Map(); // Track cache dependencies
  }

  /**
   * Get with multi-layer fallback
   */
  async get(key, options = {}) {
    try {
      // L1: In-memory
      if (this.l1Cache.has(key)) {
        const cached = this.l1Cache.get(key);
        if (cached.expiresAt > Date.now()) {
          this.cacheStats.hits++;
          return cached.value;
        } else {
          this.l1Cache.delete(key);
        }
      }

      // L2: Redis
      if (this.l2Cache) {
        const value = await get(key);
        if (value) {
          this.cacheStats.hits++;
          // Populate L1
          this.l1Cache.set(key, {
            value,
            expiresAt: Date.now() + (options.ttl || 300) * 1000,
          });
          return value;
        }
      }

      this.cacheStats.misses++;
      return null;
    } catch (error) {
      logger.error('Intelligent cache get error', { error: error.message, key });
      // Gracefully degrade - return null instead of throwing
      return null;
    }
  }

  /**
   * Set with multi-layer
   */
  async set(key, value, options = {}) {
    try {
      const ttl = options.ttl || 300;
      const expiresAt = Date.now() + ttl * 1000;

      // L1: In-memory
      this.l1Cache.set(key, { value, expiresAt });

      // L2: Redis
      if (this.l2Cache) {
        await set(key, value, ttl);
      }

      // Track dependencies
      if (options.dependsOn) {
        this.dependencies.set(key, options.dependsOn);
      }

      this.cacheStats.sets++;
      return true;
    } catch (error) {
      logger.error('Intelligent cache set error', { error: error.message, key });
      return false;
    }
  }

  /**
   * Intelligent invalidation
   */
  async invalidate(pattern, options = {}) {
    try {
      const { cascade = true } = options;

      // Find matching keys
      const keysToInvalidate = [];
      
      for (const key of this.l1Cache.keys()) {
        if (key.includes(pattern) || pattern === '*') {
          keysToInvalidate.push(key);
        }
      }

      // Invalidate L1
      keysToInvalidate.forEach(key => {
        this.l1Cache.delete(key);
      });

      // Invalidate L2
      if (this.l2Cache) {
        for (const key of keysToInvalidate) {
          await del(key);
        }
      }

      // Cascade invalidation
      if (cascade) {
        for (const [key, deps] of this.dependencies.entries()) {
          if (deps.some(dep => keysToInvalidate.includes(dep))) {
            await this.invalidate(key, { cascade: false });
          }
        }
      }

      this.cacheStats.deletes += keysToInvalidate.length;
      logger.info('Cache invalidated', { pattern, count: keysToInvalidate.length });
      return { invalidated: keysToInvalidate.length };
    } catch (error) {
      logger.error('Intelligent cache invalidation error', { error: error.message, pattern });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;

    return {
      ...this.cacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
      l1Size: this.l1Cache.size,
      dependencies: this.dependencies.size,
    };
  }

  /**
   * Warm cache
   */
  async warmCache(keys, fetcher) {
    try {
      const results = await Promise.allSettled(
        keys.map(async key => {
          const value = await fetcher(key);
          if (value) {
            await this.set(key, value);
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      logger.info('Cache warmed', { keys: keys.length, successful });
      return { warmed: successful, total: keys.length };
    } catch (error) {
      logger.error('Warm cache error', { error: error.message });
      throw error;
    }
  }
}

// Singleton instance
const intelligentCache = new IntelligentCache();

/**
 * Initialize intelligent cache
 */
function initIntelligentCache() {
  // Check if Redis is available for L2
  try {
    const redis = require('redis');
    intelligentCache.l2Cache = true; // In production, create Redis client
    logger.info('Intelligent cache initialized with L1 and L2');
  } catch (error) {
    logger.info('Intelligent cache initialized with L1 only');
  }
}

module.exports = {
  intelligentCache,
  initIntelligentCache,
};


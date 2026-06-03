/**
 * Redis Caching Utility for Click Application
 * Provides high-performance caching for API responses and data
 */

const redis = require('redis');
const crypto = require('crypto');
const logger = require('./logger');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.cachePrefix = 'click:cache:';
    this.defaultTTL = 300; // 5 minutes default
    // Real hit/miss counters so calculateHitRate() reports actual performance.
    this.hits = 0;
    this.misses = 0;
    this.connect();
  }

  /**
   * Connect to Redis with error handling
   */
  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
      const isDev = process.env.NODE_ENV !== 'production';
      const isLocalhost = redisUrl?.includes('localhost') || redisUrl?.includes('127.0.0.1') || redisUrl?.includes('::1');

      // Total Silence Guard: Skip Redis if on localhost dev
      if (process.env.NODE_ENV === 'test' || !redisUrl || (isDev && isLocalhost)) {
        logger.info('🔧 [Redis Guard] Total silencing activated. Caching layer bypassed.');
        return;
      }

      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          keepAlive: 15000,
          reconnectStrategy: (retries) => {
            if (retries > 20) {
              logger.error('Redis max reconnection retries reached');
              return new Error('Redis connection lost');
            }
            const delay = Math.min(retries * 100, 3000);
            return delay;
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('end', () => {
        this.isConnected = false;
      });

      // Connect asynchronously
      await this.client.connect();

    } catch (error) {
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Generate cache key from request data
   */
  generateKey(req, additionalData = {}) {
    const keyData = {
      method: req.method,
      url: req.originalUrl || req.url,
      userId: req.user?.id || 'anonymous',
      query: req.query,
      body: req.method !== 'GET' ? this.hashObject(req.body) : undefined,
      ...additionalData
    };

    // Remove sensitive data
    delete keyData.query.token;
    delete keyData.query.api_key;
    delete keyData.body?.password;
    delete keyData.body?.token;

    return this.cachePrefix + crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Hash sensitive data for cache keys
   */
  hashObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex').substring(0, 8);
  }

  /**
   * Get cached data
   */
  async get(key) {
    if (!this.isConnected || !this.client) return null;

    try {
      const data = await this.client.get(key);
      if (data) { this.hits++; return JSON.parse(data); }
      this.misses++;
      return null;
    } catch (error) {
      this.misses++;
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key, data, ttl = this.defaultTTL) {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.setEx(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async del(key) {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Clear all cache for a pattern
   */
  async clearPattern(pattern) {
    if (!this.isConnected || !this.client) return false;

    try {
      const keys = await this.client.keys(this.cachePrefix + pattern + '*');
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.isConnected || !this.client) {
      return {
        connected: false,
        keys: 0,
        memory: 0,
        hitRate: 0
      };
    }

    try {
      const keys = await this.client.keys(this.cachePrefix + '*');
      const info = await this.client.info('memory');

      return {
        connected: true,
        keys: keys.length,
        memory: this.parseMemoryInfo(info),
        hitRate: await this.calculateHitRate()
      };
    } catch (error) {
      
      return {
        connected: false,
        keys: 0,
        memory: 0,
        hitRate: 0
      };
    }
  }

  /**
   * Parse Redis memory info
   */
  parseMemoryInfo(info) {
    const lines = info.split('\n');
    for (const line of lines) {
      if (line.startsWith('used_memory:')) {
        return parseInt(line.split(':')[1], 10) || 0;
      }
    }
    return 0;
  }

  /**
   * Real cache hit rate from tracked hits/misses since process start.
   * Returns 0 when there have been no reads yet (honest, not a fake 0.85).
   */
  async calculateHitRate() {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return Math.round((this.hits / total) * 1000) / 1000;
  }

  /**
   * Cache middleware for Express routes
   */
  middleware(options = {}) {
    const {
      ttl = this.defaultTTL,
      skipCache = (req) => req.method !== 'GET', // Only cache GET requests by default
      keyGenerator = (req) => this.generateKey(req),
      condition = () => true // Additional caching condition
    } = options;

    return async (req, res, next) => {
      try {
        // Skip caching if conditions not met
        if (skipCache(req) || !condition(req) || !this.isConnected) {
          return next();
        }

        const cacheKey = keyGenerator(req);

        // Try to get from cache
        const cachedData = await this.get(cacheKey);
        if (cachedData) {
          
          return res.json({
            ...cachedData,
            _cached: true,
            _cacheTime: new Date().toISOString()
          });
        }

        // Cache the response
        const originalJson = res.json;
        res.json = (data) => {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.set(cacheKey, data, ttl).catch(err => {
              logger.warn('Failed to set cache in middleware', { error: err.message, key: cacheKey });
            });
          }

          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        logger.error('Redis cache middleware failure', { error: error.message });
        next();
      }
    };
  }

  /**
   * Cache invalidation helper
   */
  async invalidateUserCache(userId) {
    return this.clearPattern(`user:${userId}:`);
  }

  async invalidateContentCache(contentId) {
    return this.clearPattern(`content:${contentId}:`);
  }

  async invalidateAnalyticsCache(userId) {
    return this.clearPattern(`analytics:${userId}:`);
  }

  /**
   * Health check for Redis
   */
  async healthCheck() {
    if (!this.isConnected || !this.client) {
      return { status: 'disconnected', message: 'Redis not connected' };
    }

    try {
      await this.client.ping();
      const stats = await this.getStats();
      return {
        status: 'healthy',
        message: 'Redis connected and operational',
        stats
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Redis health check failed: ${error.message}`
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
        
      } catch (error) {
        logger.error('Failed to disconnect Redis cache', { error: error.message });
      }
    }
    this.isConnected = false;
  }
}

// Create singleton instance
const redisCache = new RedisCache();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redisCache.disconnect();
});

process.on('SIGINT', async () => {
  await redisCache.disconnect();
});

module.exports = redisCache;











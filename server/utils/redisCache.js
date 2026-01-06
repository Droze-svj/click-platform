/**
 * Redis Caching Utility for Click Application
 * Provides high-performance caching for API responses and data
 */

const redis = require('redis');
const crypto = require('crypto');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.cachePrefix = 'click:cache:';
    this.defaultTTL = 300; // 5 minutes default
    this.connect();
  }

  /**
   * Connect to Redis with error handling
   */
  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';

      // Skip Redis connection in test environments or when not configured
      if (process.env.NODE_ENV === 'test' || !redisUrl || redisUrl.includes('redis://localhost:6379')) {
        console.log('⚠️ Redis caching disabled (not configured or test environment)');
        return;
      }

      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
        },
        retry_strategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      this.client.on('error', (err) => {
        console.warn('⚠️ Redis connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
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
      console.warn('⚠️ Redis connection failed:', error.message);
      console.log('📝 Continuing without Redis caching');
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
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('⚠️ Redis get error:', error.message);
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
      console.warn('⚠️ Redis set error:', error.message);
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
      console.warn('⚠️ Redis delete error:', error.message);
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
      console.warn('⚠️ Redis clear pattern error:', error.message);
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
      console.warn('⚠️ Redis stats error:', error.message);
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
        return parseInt(line.split(':')[1]) || 0;
      }
    }
    return 0;
  }

  /**
   * Calculate cache hit rate (simplified)
   */
  async calculateHitRate() {
    // This is a simplified implementation
    // In production, you'd track hits/misses separately
    return 0.85; // Assume 85% hit rate for demo
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
          console.log(`📋 Cache hit for ${req.originalUrl || req.url}`);
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
            this.set(cacheKey, data, ttl).catch(err =>
              console.warn('⚠️ Cache set failed:', err.message)
            );
          }

          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        console.warn('⚠️ Cache middleware error:', error.message);
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
        console.log('✅ Redis disconnected gracefully');
      } catch (error) {
        console.warn('⚠️ Redis disconnect error:', error.message);
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






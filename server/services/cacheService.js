// Redis caching service

const redis = require('redis');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

// Lazy load cache monitoring to avoid circular dependencies
let cacheMonitoring = null;
function getCacheMonitoring() {
  if (!cacheMonitoring) {
    try {
      cacheMonitoring = require('./cacheMonitoringService');
    } catch (error) {
      // Monitoring not critical, continue without it
    }
  }
  return cacheMonitoring;
}

let redisClient = null;
let cacheEnabled = false;

/**
 * Initialize Redis client
 */
async function initCache() {
  try {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    
    redisClient = redis.createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
      captureException(err, { tags: { service: 'redis', type: 'client_error' } });
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      cacheEnabled = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();
    cacheEnabled = true;
    logger.info('✅ Redis cache initialized');
  } catch (error) {
    logger.warn('Redis not available, caching disabled', { error: error.message });
    cacheEnabled = false;
    // Continue without cache - graceful degradation
  }
}

/**
 * Get value from cache
 */
async function get(key) {
  if (!cacheEnabled || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (value) {
      // Track cache hit
      const monitoring = getCacheMonitoring();
      if (monitoring) monitoring.trackCacheHit(key);
      return JSON.parse(value);
    }
    // Track cache miss
    const monitoring = getCacheMonitoring();
    if (monitoring) monitoring.trackCacheMiss(key);
    return null;
  } catch (error) {
    logger.error('Cache get error', { key, error: error.message });
    const monitoring = getCacheMonitoring();
    if (monitoring) monitoring.trackCacheError(error);
    return null;
  }
}

/**
 * Set value in cache
 */
async function set(key, value, ttl = 3600) {
  if (!cacheEnabled || !redisClient) {
    return false;
  }

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    // Track cache set
    const monitoring = getCacheMonitoring();
    if (monitoring) monitoring.trackCacheSet(key);
    return true;
  } catch (error) {
    logger.error('Cache set error', { key, error: error.message });
    const monitoring = getCacheMonitoring();
    if (monitoring) monitoring.trackCacheError(error);
    return false;
  }
}

/**
 * Delete value from cache
 */
async function del(key) {
  if (!cacheEnabled || !redisClient) {
    return false;
  }

  try {
    await redisClient.del(key);
    // Track cache delete
    const monitoring = getCacheMonitoring();
    if (monitoring) monitoring.trackCacheDelete(key);
    return true;
  } catch (error) {
    logger.error('Cache delete error', { key, error: error.message });
    const monitoring = getCacheMonitoring();
    if (monitoring) monitoring.trackCacheError(error);
    return false;
  }
}

/**
 * Delete multiple keys matching pattern
 */
async function delPattern(pattern) {
  if (!cacheEnabled || !redisClient) {
    return false;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return true;
  } catch (error) {
    logger.error('Cache delete pattern error', { pattern, error: error.message });
    return false;
  }
}

/**
 * Check if key exists
 */
async function exists(key) {
  if (!cacheEnabled || !redisClient) {
    return false;
  }

  try {
    const result = await redisClient.exists(key);
    return result === 1;
  } catch (error) {
    logger.error('Cache exists error', { key, error: error.message });
    return false;
  }
}

/**
 * Get or set (cache-aside pattern)
 */
async function getOrSet(key, fetchFn, ttl = 3600) {
  // Try to get from cache
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch from source
  const value = await fetchFn();
  
  // Store in cache
  if (value !== null && value !== undefined) {
    await set(key, value, ttl);
  }

  return value;
}

/**
 * Invalidate cache for user
 */
async function invalidateUserCache(userId) {
  if (!cacheEnabled || !redisClient) {
    return;
  }

  try {
    await delPattern(`user:${userId}:*`);
    await delPattern(`content:${userId}:*`);
    await delPattern(`analytics:${userId}:*`);
    logger.info('User cache invalidated', { userId });
  } catch (error) {
    logger.error('Cache invalidation error', { userId, error: error.message });
  }
}

/**
 * Cache middleware
 */
function cacheMiddleware(ttl = 3600, keyGenerator = null) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cached = await get(cacheKey);
    if (cached !== null) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json to cache response
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        set(cacheKey, data, ttl).catch(err => {
          logger.error('Cache set error in middleware', { error: err.message });
        });
      }
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

/**
 * Close Redis connection
 */
async function closeCache() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis cache closed');
    } catch (error) {
      logger.error('Error closing Redis cache', { error: error.message });
    }
  }
}

module.exports = {
  initCache,
  get,
  set,
  del,
  delPattern,
  exists,
  getOrSet,
  invalidateUserCache,
  cacheMiddleware,
  closeCache,
  isEnabled: () => cacheEnabled,
};




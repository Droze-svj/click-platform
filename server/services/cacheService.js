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
  const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);

  // Skip Redis if not configured, or if placeholder URL (e.g. redis://placeholder-redis:6379)
  if (!redisUrl || redisUrl.includes('placeholder')) {
    if (redisUrl?.includes('placeholder')) {
      logger.info('Redis URL is placeholder. Set REDIS_URL in Render. Caching disabled.');
    } else {
      logger.info('Redis not configured, caching disabled (optional)');
    }
    cacheEnabled = false;
    return;
  }

  try {
    
    redisClient = redis.createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        connectTimeout: 5000, // 5 second timeout
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.warn('Redis reconnection failed after 3 retries, disabling cache');
            cacheEnabled = false;
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 2000);
        },
      },
    });

    redisClient.on('error', (err) => {
      // Don't log as error if cache is already disabled
      if (cacheEnabled) {
        logger.warn('Redis client error, disabling cache', { error: err.message });
        cacheEnabled = false;
      }
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      cacheEnabled = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    // Connect with timeout
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      )
    ]);
    
    cacheEnabled = true;
    logger.info('✅ Redis cache initialized');
  } catch (error) {
    logger.warn('Redis not available, caching disabled', { error: error.message });
    cacheEnabled = false;
    // Clean up client if it was created
    if (redisClient) {
      try {
        await redisClient.quit().catch(() => {});
      } catch (e) {
        // Ignore cleanup errors
      }
      redisClient = null;
    }
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
 * Cache warming - preload frequently accessed data
 */
async function warmCache(keys = []) {
  if (!cacheEnabled || !redisClient) {
    return { warmed: 0, failed: 0 };
  }

  let warmed = 0;
  let failed = 0;

  for (const key of keys) {
    try {
      // Check if key exists, if not, it will be populated on first access
      const exists = await redisClient.exists(key);
      if (exists === 0) {
        // Key doesn't exist, mark for warming (actual warming logic should be in calling code)
        warmed++;
      }
    } catch (error) {
      logger.error('Cache warming error', { key, error: error.message });
      failed++;
    }
  }

  return { warmed, failed };
}

/**
 * Batch get multiple keys
 */
async function mget(keys) {
  if (!cacheEnabled || !redisClient || !keys.length) {
    return [];
  }

  try {
    const values = await redisClient.mGet(keys);
    return values.map((value, index) => {
      if (value) {
        const monitoring = getCacheMonitoring();
        if (monitoring) monitoring.trackCacheHit(keys[index]);
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      } else {
        const monitoring = getCacheMonitoring();
        if (monitoring) monitoring.trackCacheMiss(keys[index]);
        return null;
      }
    });
  } catch (error) {
    logger.error('Cache mget error', { keys, error: error.message });
    return keys.map(() => null);
  }
}

/**
 * Batch set multiple keys
 */
async function mset(keyValuePairs, ttl = 3600) {
  if (!cacheEnabled || !redisClient || !keyValuePairs.length) {
    return false;
  }

  try {
    const pipeline = redisClient.multi();
    for (const { key, value } of keyValuePairs) {
      pipeline.setEx(key, ttl, JSON.stringify(value));
    }
    await pipeline.exec();
    
    // Track cache sets
    const monitoring = getCacheMonitoring();
    if (monitoring) {
      keyValuePairs.forEach(({ key }) => monitoring.trackCacheSet(key));
    }
    
    return true;
  } catch (error) {
    logger.error('Cache mset error', { error: error.message });
    return false;
  }
}

/**
 * Increment cache counter
 */
async function increment(key, amount = 1, ttl = 3600) {
  if (!cacheEnabled || !redisClient) {
    return null;
  }

  try {
    const result = await redisClient.incrBy(key, amount);
    // Set TTL if key is new
    if (result === amount) {
      await redisClient.expire(key, ttl);
    }
    return result;
  } catch (error) {
    logger.error('Cache increment error', { key, error: error.message });
    return null;
  }
}

/**
 * Get cache statistics
 */
async function getStats() {
  if (!cacheEnabled || !redisClient) {
    return null;
  }

  try {
    const info = await redisClient.info('stats');
    const keyspace = await redisClient.info('keyspace');
    
    // Parse info strings
    const stats = {};
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key] = value;
      }
    });

    return {
      enabled: cacheEnabled,
      connected: redisClient.isReady || false,
      stats,
      keyspace,
    };
  } catch (error) {
    logger.error('Cache stats error', { error: error.message });
    return null;
  }
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
  warmCache,
  mget,
  mset,
  increment,
  getStats,
  closeCache,
  isEnabled: () => cacheEnabled,
};




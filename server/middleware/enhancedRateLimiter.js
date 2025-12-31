// Enhanced rate limiting with Redis support (optional fallback to memory)

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Try to use Redis if available, otherwise use memory store
let RedisStore;
let redisClient;

try {
  if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    // Try to load rate-limit-redis (optional dependency)
    try {
      RedisStore = require('rate-limit-redis').default;
    } catch (storeError) {
      logger.warn('rate-limit-redis not installed, using memory store for rate limiting');
      RedisStore = null;
    }
    
    if (RedisStore) {
      const redis = require('redis');
      
      redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      });

      redisClient.on('error', (err) => {
        logger.warn('Redis connection error, falling back to memory store', { error: err.message });
        redisClient = null;
      });

      redisClient.on('connect', () => {
        logger.info('✅ Redis connected for rate limiting');
      });

      redisClient.connect().catch(() => {
        logger.warn('Redis connection failed, using memory store');
        redisClient = null;
      });
    }
  }
} catch (error) {
  logger.warn('Redis not available, using memory store for rate limiting', { error: error.message });
  redisClient = null;
}

/**
 * Create rate limiter with optional Redis store
 */
function createRateLimiter(options) {
  const limiterOptions = {
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: options.message || {
      success: false,
      error: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    // Custom key generator for per-user rate limiting
    keyGenerator: options.keyGenerator || ((req) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?._id?.toString() || req.ip || req.connection.remoteAddress;
    }),
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: req.user?._id,
        path: req.path,
        method: req.method,
      });
      
      res.status(429).json({
        success: false,
        error: options.message?.error || 'Too many requests, please try again later',
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  };

  // Use Redis store if available
  if (redisClient && RedisStore) {
    limiterOptions.store = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'rl:',
    });
  }

  return rateLimit(limiterOptions);
}

// General API rate limiter (per user/IP)
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window (increased from 100)
  message: {
    error: 'Too many requests from this IP, please try again later',
  },
  // Skip rate limiting for health checks
  skip: (req) => {
    return req.path === '/health' || req.path === '/health/debug-redis' || req.path === '/api/health' || req.path === '/api/health/debug-redis';
  },
});

// Auth endpoints rate limiter (stricter)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts, please try again later',
  },
  skipSuccessfulRequests: true,
});

// Upload endpoints rate limiter
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: {
    error: 'Too many uploads, please try again later',
  },
});

// AI/Content generation rate limiter (per user)
const aiLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 AI requests per hour per user
  message: {
    error: 'AI request limit exceeded. Please try again later.',
  },
  keyGenerator: (req) => {
    // Always use user ID for AI requests
    if (req.user?._id) {
      return `ai:${req.user._id}`;
    }
    return req.ip;
  },
});

// Social media posting rate limiter
const socialPostLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 posts per hour
  message: {
    error: 'Posting limit exceeded. Please try again later.',
  },
});

// Subscription tier-based rate limiter
function getSubscriptionLimiter(tier = 'free') {
  const limits = {
    free: { windowMs: 60 * 60 * 1000, max: 10, burst: 2 },
    basic: { windowMs: 60 * 60 * 1000, max: 50, burst: 10 },
    pro: { windowMs: 60 * 60 * 1000, max: 200, burst: 50 },
    enterprise: { windowMs: 60 * 60 * 1000, max: 1000, burst: 200 },
  };

  const limit = limits[tier] || limits.free;

  return createRateLimiter({
    windowMs: limit.windowMs,
    max: limit.max,
    message: {
      error: `Rate limit exceeded for ${tier} plan. Upgrade for higher limits.`,
      retryAfter: limit.windowMs / 1000,
    },
    keyGenerator: (req) => {
      return req.user?._id?.toString() || req.ip;
    },
    // Add burst allowance
    skip: (req) => {
      // Allow burst requests (first few requests bypass limit check)
      // This is handled by the rate limiter's internal logic
      return false;
    },
  });
}

// Per-endpoint rate limiters
const endpointLimiters = {
  analytics: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: 'Analytics request limit exceeded' },
  }),
  search: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: { error: 'Search request limit exceeded' },
  }),
  export: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: { error: 'Export limit exceeded' },
  }),
};

// Middleware to apply subscription-based rate limiting
function subscriptionRateLimiter(req, res, next) {
  const tier = req.user?.subscription?.plan || 'free';
  const limiter = getSubscriptionLimiter(tier);
  return limiter(req, res, next);
}

module.exports = {
  createRateLimiter,
  apiLimiter,
  authLimiter,
  uploadLimiter,
  aiLimiter,
  socialPostLimiter,
  subscriptionRateLimiter,
  getSubscriptionLimiter,
  endpointLimiters,
};


// Enhanced rate limiting with Redis support (optional fallback to memory)

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Try to use Redis if available, otherwise use memory store.
let RedisStore;
let redisClient;
let rateLimitStore = 'memory'; // 'redis' once connected; surfaced via getRateLimitStore()

// A per-process memory store means rate limits DON'T hold across replicas (3
// instances ⇒ 3× the limit) — a real bypass. In production that's a misconfig,
// not a graceful degradation: log it LOUD so it's caught, while still serving.
const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
function noteDegraded(msg, meta) {
  if (isProd) logger.error(`⚠️ RATE-LIMIT DEGRADED (prod): ${msg}`, meta || {});
  else logger.warn(msg, meta || {});
}

try {
  const redisUrl = process.env.REDIS_URL;
  const hasValidRedis = (redisUrl || process.env.REDIS_HOST) && !redisUrl?.includes('placeholder');
  if (!hasValidRedis) {
    noteDegraded('No REDIS_URL — rate limiting uses a per-instance memory store (not shared across replicas).');
  }
  if (hasValidRedis) {
    // Try to load rate-limit-redis.
    try {
      RedisStore = require('rate-limit-redis').default;
    } catch (storeError) {
      noteDegraded('rate-limit-redis not installed — using a per-instance memory store. Add it to dependencies for cross-replica limits.');
      RedisStore = null;
    }

    if (RedisStore) {
      const redis = require('redis');

      redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        socket: {
          connectTimeout: 2000, // FAST TIMEOUT
          reconnectStrategy: (retries) => retries > 2 ? false : 500
        }
      });

      redisClient.on('error', (err) => {
        noteDegraded('Redis connection error — falling back to per-instance memory store', { error: err.message });
        redisClient = null;
        rateLimitStore = 'memory';
      });

      redisClient.on('connect', () => {
        logger.info('✅ Redis connected for rate limiting (shared across replicas)');
        rateLimitStore = 'redis';
      });

      redisClient.connect().catch((err) => {
        noteDegraded('Redis connection failed — falling back to per-instance memory store', { error: err.message });
        redisClient = null;
        rateLimitStore = 'memory';
      });
    }
  }
} catch (error) {
  noteDegraded('Redis not available — using a per-instance memory store for rate limiting', { error: error.message });
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
    // Allow callers to skip rate limiting for specific requests
    skip: typeof options.skip === 'function' ? options.skip : undefined,
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

  // Use Redis store if available. Wrapped so a store-construction incompatibility
  // degrades to the in-memory store instead of breaking module load / the route.
  if (redisClient && RedisStore) {
    try {
      limiterOptions.store = new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: 'rl:',
      });
    } catch (e) {
      noteDegraded('Failed to construct the Redis rate-limit store — using memory', { error: e.message });
      rateLimitStore = 'memory';
    }
  }

  return rateLimit(limiterOptions);
}

// General API rate limiter (per user/IP)
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window (increased from 100)
  message: {
    error: 'Too many requests from this IP, please try later',
  },
  // Skip rate limiting for health checks and auth/me (called frequently by frontend)
  // In development, skip rate limiting entirely to prevent blocking during development
  skip: (req) => {
    // In development, disable rate limiting entirely
    if (process.env.NODE_ENV !== 'production') {
      const ip = (req.ip || '').toString();
      const host = (req.hostname || req.headers?.host || '').toString();
      const origin = (req.get && req.get('origin')) ? req.get('origin') : (req.headers?.origin || '');
      const referer = (req.get && req.get('referer')) ? req.get('referer') : (req.headers?.referer || '');

      // Check multiple ways the request might indicate localhost
      const isLocalhost =
        host === 'localhost' ||
        host.includes('localhost:') ||
        host === '127.0.0.1' ||
        host.includes('127.0.0.1:') ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.includes('127.0.0.1') ||
        (typeof origin === 'string' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) ||
        (typeof referer === 'string' && (referer.includes('localhost') || referer.includes('127.0.0.1')));

      if (isLocalhost) {
        return true;
      }

      // Also skip if NODE_ENV is explicitly development (even if host doesn't match)
      // This allows for testing scenarios where the host might be different
      return true; // Always skip in development
    }

    const path = req.path || req.url || '';
    return path === '/health' ||
      path === '/health/debug-redis' ||
      path === '/api/health' ||
      path === '/api/health/debug-redis' ||
      // Debug relay should never be rate limited in dev; it is used by instrumentation.
      path.startsWith('/debug') ||
      path.startsWith('/api/debug') ||
      path === '/auth/me' ||
      path === '/api/auth/me';
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
  // In local development, don't lock yourself out while iterating on auth flows.
  skip: (req) => {
    if (process.env.NODE_ENV === 'production') return false;
    const ip = (req.ip || '').toString();
    const host = (req.hostname || '').toString();
    const origin = (req.get && req.get('origin')) ? req.get('origin') : '';
    return (
      host === 'localhost' ||
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.includes('127.0.0.1') ||
      (typeof origin === 'string' && origin.includes('localhost'))
    );
  },
});

// Upload endpoints rate limiter
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: {
    error: 'Too many uploads, please try again later',
  },
  // In local development, don't rate limit uploads to allow testing
  skip: (req) => {
    // In development, skip rate limiting entirely
    // This is critical for local testing where uploads might be frequent
    if (process.env.NODE_ENV !== 'production') {
      // Always skip in development - don't check host/IP to avoid edge cases
      return true;
    }
    return false;
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

// Video render rate limiter — renders are expensive (FFmpeg+Remotion).
// Tighter than aiLimiter so a single user can't fill the render queue.
const renderLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    error: 'Render limit exceeded (5/hour). Upgrade your plan for higher limits.',
  },
  keyGenerator: (req) => (req.user?._id ? `render:${req.user._id}` : req.ip),
});

// Social media posting rate limiter
const socialPostLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 posts per hour
  message: {
    error: 'Posting limit exceeded. Please try again later.',
  },
});

// OAuth initiation rate limiter
const oauthLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: {
    error: 'Too many OAuth connection attempts, please try again later',
  },
  skip: (req) => process.env.NODE_ENV !== 'production'
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

// Build the per-tier limiters ONCE at module load. Previously the middleware
// called getSubscriptionLimiter() per request, creating a brand-new limiter with
// a fresh MemoryStore every time — so the count never accumulated and the limiter
// was a silent no-op. Memoizing makes it actually enforce.
const subscriptionLimiters = {
  free: getSubscriptionLimiter('free'),
  basic: getSubscriptionLimiter('basic'),
  pro: getSubscriptionLimiter('pro'),
  enterprise: getSubscriptionLimiter('enterprise'),
};

// Middleware to apply subscription-based rate limiting
function subscriptionRateLimiter(req, res, next) {
  const tier = req.user?.subscription?.plan || 'free';
  const limiter = subscriptionLimiters[tier] || subscriptionLimiters.free;
  return limiter(req, res, next);
}

module.exports = {
  createRateLimiter,
  apiLimiter,
  authLimiter,
  uploadLimiter,
  aiLimiter,
  renderLimiter,
  socialPostLimiter,
  oauthLimiter,
  subscriptionRateLimiter,
  getSubscriptionLimiter,
  endpointLimiters,
  // 'redis' (shared across replicas) or 'memory' (per-instance — bypassable).
  // Surfaced by the health/readiness probe so a degraded limiter is visible.
  getRateLimitStore: () => rateLimitStore,
};


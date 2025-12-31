// Enhanced health check endpoint with integration status

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isCloudStorageEnabled } = require('../services/storageService');
const { isConfigured: isTwitterOAuthConfigured } = require('../services/twitterOAuthService');
const logger = require('../utils/logger');

/**
 * Check database connection
 */
async function checkDatabase() {
  try {
    if (mongoose.connection.readyState === 1) {
      // Ping database
      await mongoose.connection.db.admin().ping();
      return { connected: true, latency: Date.now() };
    }
    return { connected: false, error: 'Not connected' };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * Check Redis connection (if configured)
 */
async function checkRedis() {
  try {
    const redis = require('redis');
    if (!process.env.REDIS_URL) {
      return { enabled: false, status: 'not configured' };
    }

    const client = redis.createClient({ url: process.env.REDIS_URL });
    await client.connect();
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;
    await client.quit();

    return { enabled: true, connected: true, latency: `${latency}ms` };
  } catch (error) {
    return { enabled: true, connected: false, error: error.message };
  }
}

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const [dbStatus, redisStatus] = await Promise.all([
      checkDatabase(),
      checkRedis()
    ]);

    const health = {
      status: dbStatus.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${Date.now() - startTime}ms`,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      integrations: {
        sentry: {
          enabled: !!process.env.SENTRY_DSN,
          status: process.env.SENTRY_DSN ? 'configured' : 'not configured',
        },
        s3: {
          enabled: isCloudStorageEnabled(),
          status: isCloudStorageEnabled() ? 'configured' : 'using local storage',
          bucket: process.env.AWS_S3_BUCKET || null,
        },
        oauth: {
          twitter: {
            enabled: isTwitterOAuthConfigured(),
            configured: !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
          },
          linkedin: {
            enabled: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
          },
          facebook: {
            enabled: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
          },
        },
        database: dbStatus,
        redis: redisStatus,
      },
    };

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/health/test-sentry:
 *   post:
 *     summary: Test Sentry integration
 *     tags: [Health]
 */
router.post('/test-sentry', (req, res) => {
  try {
    const { captureMessage, captureException } = require('../utils/sentry');
    
    // Test message
    captureMessage('Health check test message', 'info', {
      tags: { source: 'health_check' },
    });

    // Test exception
    const testError = new Error('Health check test error');
    captureException(testError, {
      tags: { source: 'health_check', test: true },
    });

    res.json({
      success: true,
      message: 'Test messages sent to Sentry. Check your Sentry dashboard.',
    });
  } catch (error) {
    logger.error('Sentry test error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/health/debug-redis:
 *   get:
 *     summary: Debug Redis configuration (for troubleshooting)
 *     tags: [Health]
 */
router.get('/debug-redis', (req, res) => {
  try {
    const rawRedisUrl = process.env.REDIS_URL;
    const { getRedisConnection } = require('../services/jobQueueService');
    
    // Get the connection object that would be used
    const connection = getRedisConnection();
    
    // Mask sensitive parts of REDIS_URL for logging
    const maskUrl = (url) => {
      if (!url) return null;
      if (typeof url === 'string') {
        // Mask password in redis://default:password@host:port
        return url.replace(/:([^:@]+)@/, ':****@');
      }
      return url;
    };

    const debug = {
      environment: process.env.NODE_ENV,
      redisUrl: {
        exists: !!rawRedisUrl,
        length: rawRedisUrl?.length || 0,
        firstChars: rawRedisUrl ? rawRedisUrl.substring(0, 30) : null,
        lastChars: rawRedisUrl && rawRedisUrl.length > 30 ? '...' + rawRedisUrl.substring(rawRedisUrl.length - 20) : null,
        masked: maskUrl(rawRedisUrl),
        hasQuotes: rawRedisUrl ? (rawRedisUrl.startsWith('"') || rawRedisUrl.startsWith("'") || rawRedisUrl.endsWith('"') || rawRedisUrl.endsWith("'")) : false,
        hasSpaces: rawRedisUrl ? rawRedisUrl.trim() !== rawRedisUrl : false,
        containsLocalhost: rawRedisUrl ? (rawRedisUrl.includes('localhost') || rawRedisUrl.includes('127.0.0.1')) : false,
      },
      connection: {
        type: connection ? typeof connection : 'null',
        isString: typeof connection === 'string',
        isObject: typeof connection === 'object' && connection !== null,
        value: connection ? (typeof connection === 'string' ? maskUrl(connection) : JSON.stringify(connection)) : null,
        containsLocalhost: connection ? (String(connection).includes('localhost') || String(connection).includes('127.0.0.1')) : false,
      },
      redisHost: process.env.REDIS_HOST || null,
      redisPort: process.env.REDIS_PORT || null,
      redisPassword: process.env.REDIS_PASSWORD ? '***' : null,
    };

    res.json(debug);
  } catch (error) {
    logger.error('Redis debug error', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;

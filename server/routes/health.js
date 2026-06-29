// Enhanced health check endpoint with integration status

const express = require('express');
const router = express.Router();
const { isCloudStorageEnabled } = require('../services/storageService');
const twitterOAuth = require('../services/twitterOAuthService');
const { getRedisConnection } = require('../services/jobQueueService');
const logger = require('../utils/logger');

/**
 * Check Supabase database connection
 */
async function checkDatabase() {
  try {
    if (process.env.NODE_ENV === 'test') {
      return { connected: true, mock: true, latency: '0ms' };
    }
    // Check if Supabase is configured
    if (!process.env.SUPABASE_URL) {
      return { connected: false, error: 'SUPABASE_URL not set' };
    }

    if (!process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { connected: false, error: 'SUPABASE keys not set' };
    }

    // Import Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test connection with a simple query
    const start = Date.now();
    const { data, error } = await supabase.from('users').select('count').limit(1);
    const latency = Date.now() - start;

    if (error) {
      return { connected: false, error: `Supabase error: ${error.message}` };
    }

    return { connected: true, latency: `${latency}ms` };
  } catch (error) {
    return { connected: false, error: `Connection error: ${error.message}` };
  }
}

/**
 * Check Redis connection (if configured)
 */
async function checkRedis() {
  try {
    const redis = require('redis');
    const isDev = process.env.NODE_ENV !== 'production';
    const isLocalhost = process.env.REDIS_URL?.includes('localhost') || process.env.REDIS_URL?.includes('127.0.0.1');

    if (!process.env.REDIS_URL || (isDev && isLocalhost)) {
      return { enabled: !!process.env.REDIS_URL, status: isDev && isLocalhost ? 'Local-Guard Bypassed' : 'not configured' };
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
 * Check BullMQ Queue status
 */
async function checkQueues() {
  try {
    if (process.env.NODE_ENV === 'test') {
      return { status: 'disabled', reason: 'Queue checks bypassed in test environment' };
    }
    const { getRedisConnection, getQueue } = require('../services/jobQueueService');
    const redis = await getRedisConnection();
    if (!redis) return { status: 'disabled', reason: 'No Redis connection' };

    const queues = ['video-processing', 'content-generation', 'email-delivery', 'transcript-generation'];
    const status = {};

    for (const q of queues) {
      // Basic check if queue is responsive
      try {
        let count;
        if (redis && typeof redis.llen === 'function') {
          count = await redis.llen(`bull:${q}:wait`);
        } else {
          const queue = getQueue(q);
          count = await queue.getWaitingCount();
        }
        status[q] = { active: true, waitingJobs: count };
      } catch (e) {
        status[q] = { active: false, error: e.message };
      }
    }

    return status;
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

// Promise wrapper that resolves to a graceful "timeout" entry rather than
// rejecting — so a single hung dep never tears down the whole probe.
function withTimeout(p, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({ connected: false, error: `${label} timed out after ${ms}ms` }), ms);
  });
  return Promise.race([
    p.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    timeoutPromise
  ]).catch((err) => {
    clearTimeout(timeoutId);
    throw err;
  });
}

// Mongo probe — reads readyState off the global mongoose connection so we
// don't open a second one per request.
async function checkMongo() {
  try {
    const mongoose = require('mongoose');
    const readyState = mongoose.connection?.readyState; // 1 = connected
    const STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    if (readyState === 1) {
      // Treat readyState=1 as healthy. We previously did an admin.ping()
      // here but it occasionally hangs on Atlas-backed deployments even
      // when reads/writes succeed — false negatives are worse than no
      // active probe at all. If a finer check is needed, add a 1-doc
      // collection ping with its own short timeout instead.
      return { connected: true, readyState: 'connected' };
    }
    return { connected: false, readyState: STATES[readyState] || `unknown(${readyState})` };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// Gemini ping — cached for 60s so we don't slam the API with every
// readiness check. Failures are non-fatal: we surface them but the
// readiness gate doesn't trip on Gemini being down.
let geminiCache = { at: 0, result: null };
async function checkGemini() {
  if (process.env.NODE_ENV === 'test') {
    return { connected: true, mock: true, provider: 'gemini', latency: '0ms' };
  }
  const now = Date.now();
  if (geminiCache.result && now - geminiCache.at < 60_000) {
    return { ...geminiCache.result, cached: true };
  }
  try {
    const { aiCall } = require('../utils/aiRouter');
    const start = Date.now();
    const r = await aiCall('ok', { maxTokens: 5, taskKind: 'fast' });
    const result = r?.text
      ? { connected: true, provider: r.provider, latency: `${Date.now() - start}ms` }
      : { connected: false, error: r?.error || 'empty response' };
    geminiCache = { at: now, result };
    return result;
  } catch (err) {
    const result = { connected: false, error: err.message };
    geminiCache = { at: now, result };
    return result;
  }
}

/**
 * GET /api/health
 *
 * Deep readiness probe. Returns HTTP 503 when any *required* dependency
 * is unreachable (Supabase, Mongo, Redis). Gemini failures are
 * surfaced but do NOT trip readiness — the app still functions for
 * non-AI surfaces when Gemini is rate-limited.
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const PROBE_TIMEOUT_MS = 5000;

  const [dbStatus, mongoStatus, redisStatus, geminiStatus] = await Promise.all([
    withTimeout(checkDatabase(), PROBE_TIMEOUT_MS, 'Supabase'),
    withTimeout(checkMongo(),    PROBE_TIMEOUT_MS, 'Mongo'),
    withTimeout(checkRedis(),    PROBE_TIMEOUT_MS, 'Redis'),
    withTimeout(checkGemini(),   PROBE_TIMEOUT_MS, 'Gemini'),
  ]);

  // Readiness rule: if ANY required dep is down, the service is not
  // ready. Redis is required when REDIS_URL is configured (it gates the
  // workers). Gemini is non-blocking.
  const isTest = process.env.NODE_ENV === 'test';
  const supabaseRequired = !isTest && !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const mongoRequired = !isTest && !!process.env.MONGODB_URI;
  const redisRequired = !isTest && !!process.env.REDIS_URL && !/localhost|127\.0\.0\.1/.test(process.env.REDIS_URL || '');

  const failures = [];
  if (supabaseRequired && dbStatus.connected === false) failures.push('supabase');
  if (mongoRequired && mongoStatus.connected === false) failures.push('mongo');
  if (redisRequired && redisStatus.connected === false) failures.push('redis');

  const httpCode = failures.length === 0 ? 200 : 503;
  const overall = failures.length === 0 ? 'ok' : 'degraded';

  const health = {
    status: overall,
    failures,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: `${Date.now() - startTime}ms`,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
    deps: {
      supabase: dbStatus,
      mongo: mongoStatus,
      redis: redisStatus,
      gemini: geminiStatus,
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
        twitter:  { enabled: twitterOAuth.isConfigured() },
        youtube:  { enabled: !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) },
        linkedin: { enabled: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) },
        facebook: { enabled: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) },
        google:   { enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) },
        encryption: {
          enabled: !!process.env.OAUTH_ENCRYPTION_KEY,
          status: process.env.OAUTH_ENCRYPTION_KEY ? 'configured' : 'using default (INSECURE)',
        },
      },
      queues: await checkQueues().catch((err) => ({ status: 'error', message: err.message })),
      c2pa: await require('../services/c2paService').verifyC2paTools().catch((err) => ({ available: false, error: err.message })),
      system: {
        ioLatency: `${Date.now() - startTime}ms`,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      },
    },
  };

  res.status(httpCode).json(health);
});

/**
 * GET /api/health/c2pa
 *
 * Reports which C2PA signer (c2pa-node / c2patool) is available, if any.
 * 200 when a signer is present, 503 when provenance signing is unavailable
 * (non-fatal for the app — renders just go unsigned).
 */
router.get('/c2pa', async (req, res) => {
  try {
    const { verifyC2paTools } = require('../services/c2paService');
    const result = await verifyC2paTools({ useCache: false });
    res.status(result.available ? 200 : 503).json(result);
  } catch (err) {
    res.status(503).json({ available: false, signer: null, error: err.message });
  }
});

/**
 * GET /api/health/light
 *
 * Liveness probe — always 200 if the process is up. Use this for k8s
 * livenessProbe so a transient Mongo blip doesn't trigger a pod restart.
 * `/api/health` is the readiness probe.
 */
router.get('/light', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/health/ready
 *
 * Conventional readiness alias (the deep `/api/health` is the full one). Returns
 * 503 when a REQUIRED dependency (Mongo, or Redis when configured) is unreachable
 * so the load balancer drains a process that's alive but can't serve. Also reports
 * the rate-limit store — `memory` means limits are per-instance (not shared across
 * replicas), which is a prod misconfiguration to alert on.
 */
router.get('/ready', async (req, res) => {
  const isTest = process.env.NODE_ENV === 'test';
  const [mongo, redis] = await Promise.all([
    withTimeout(checkMongo(), 3000, 'Mongo').catch(() => ({ connected: false })),
    withTimeout(checkRedis(), 3000, 'Redis').catch(() => ({ connected: false })),
  ]);
  const mongoRequired = !isTest && !!process.env.MONGODB_URI;
  const redisRequired = !isTest && !!process.env.REDIS_URL && !/localhost|127\.0\.0\.1/.test(process.env.REDIS_URL || '');
  const failures = [];
  if (mongoRequired && mongo.connected === false) failures.push('mongo');
  if (redisRequired && redis.connected === false) failures.push('redis');

  let rateLimitStore = 'unknown';
  try { rateLimitStore = require('../middleware/enhancedRateLimiter').getRateLimitStore(); } catch (_) { /* optional */ }

  res.status(failures.length ? 503 : 200).json({
    status: failures.length ? 'not_ready' : 'ready',
    failures,
    rateLimitStore,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/signed-media
 *
 * Readiness probe for the private-media signing/enforcement system, so the
 * REQUIRE_SIGNED_MEDIA cutover can be confirmed from outside the box.
 * Reports ONLY non-sensitive booleans/config (never the secret), plus a live
 * signer self-test: it signs a throwaway probe path with the ACTIVE secret and
 * verifies it round-trips — proving signing actually works in this environment.
 *   - enforced:        REQUIRE_SIGNED_MEDIA is on (unsigned /uploads → 403)
 *   - dedicatedSecret: MEDIA_URL_SECRET is set (vs. falling back to JWT_SECRET)
 *   - signerSelfTest:  'ok' means sign→verify succeeded with the active secret
 */
router.get('/signed-media', (req, res) => {
  try {
    const { signMediaUrl, verifyMediaUrl, DEFAULT_TTL_SEC } = require('../utils/mediaUrlSigner');
    const probePath = '/uploads/_readiness_probe.bin';
    let signerSelfTest = 'fail';
    try {
      const signed = signMediaUrl(probePath, 60);
      const q = new URLSearchParams((signed.split('?')[1]) || '');
      signerSelfTest = verifyMediaUrl(probePath, q.get('exp'), q.get('sig')) ? 'ok' : 'fail';
    } catch (_) { signerSelfTest = 'fail'; }

    const publicPrefixes = String(process.env.PUBLIC_MEDIA_PREFIXES || 'fonts/')
      .split(',').map((s) => s.trim()).filter(Boolean);

    const enforced = process.env.REQUIRE_SIGNED_MEDIA === 'true';
    res.status(200).json({
      status: signerSelfTest === 'ok' ? 'ok' : 'degraded',
      signedMedia: {
        enforced,
        mode: enforced ? 'enforcing (unsigned /uploads → 403)' : 'signing-only (gate off)',
        dedicatedSecret: !!process.env.MEDIA_URL_SECRET,
        ttlSeconds: DEFAULT_TTL_SEC,
        publicPrefixes,
        signerSelfTest,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Cache the live AI round-trip result for 30s so an unauthenticated `?live=1`
// can't be spammed into repeated paid calls.
let _aiProbeCache = { at: 0, result: 'skipped' };

/**
 * GET /api/health/ai
 *
 * Readiness probe for the AI providers — lets you confirm REAL AI is live (not the
 * hardcoded #viral #trending fallback) after setting GOOGLE_AI_API_KEY. Reports
 * configuration only by default (fast + free); add `?live=1` for an actual ~8-token
 * round-trip (throttled to once/30s). Never leaks keys.
 *   - configured: at least one provider key is set + the SDK initialized
 *   - mode:       "live AI" vs "FALLBACK (no provider key)" — if FALLBACK, every AI
 *                 feature is returning canned output, NOT real generation
 *   - liveTest:   "ok" means a real provider call round-tripped successfully
 */
router.get('/ai', async (req, res) => {
  try {
    const googleAI = require('../utils/googleAI');
    const providers = {
      gemini: !!process.env.GOOGLE_AI_API_KEY && !!googleAI.isConfigured,
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    };
    const configured = Object.values(providers).some(Boolean);

    let liveTest = 'skipped';
    if (String(req.query.live) === '1' && configured) {
      const now = Date.now();
      if (now - _aiProbeCache.at < 30000) {
        liveTest = _aiProbeCache.result;
      } else {
        try {
          const { aiCall } = require('../utils/aiRouter');
          const r = await aiCall('Reply with exactly the two letters: OK', { maxTokens: 8, label: 'health-ai-probe' });
          const text = r && (r.text != null ? r.text : r);
          liveTest = r && r.provider !== 'none' && /ok/i.test(String(text || '')) ? 'ok' : 'fail';
        } catch (_) {
          liveTest = 'fail';
        }
        _aiProbeCache = { at: now, result: liveTest };
      }
    }

    res.status(configured ? 200 : 503).json({
      status: configured ? (liveTest === 'fail' ? 'degraded' : 'ok') : 'degraded',
      ai: {
        configured,
        mode: configured ? 'live AI' : 'FALLBACK (no provider key) — AI returns canned output',
        model: 'gemini-2.5-flash',
        providers,
        liveTest,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * GET /api/health/learning
 *
 * Read-only observability surface for Click's continuous-learning loop.
 * Returns the last-run timestamp + summary for each scheduled job from
 * in-memory module state (no DB reads, no loop mutation). Each module
 * require is wrapped so a missing/uninitialised service can never 500 the
 * probe — it just reports null for that job.
 */
router.get('/learning', (req, res) => {
  const safeStats = (modulePath) => {
    try {
      const mod = require(modulePath);
      return (typeof mod.getLastRunStats === 'function' ? mod.getLastRunStats() : null) || null;
    } catch (err) {
      return { error: err.message };
    }
  };

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    autonomousMode: (() => {
      try {
        return require('../utils/cronLock').autonomousModeEnabled();
      } catch {
        return null;
      }
    })(),
    jobs: {
      platformIngestion: safeStats('../services/platformIngestionCronService'),
      performanceLearning: safeStats('../services/performanceLearningCron'),
      trendsIngest: safeStats('../jobs/trendsIngestJob'),
    },
  });
});

/**
 * @swagger
 * /api/health/trigger-sentry-error:
 *   get:
 *     summary: Trigger a real Sentry exception for DSN verification
 *     tags: [Health]
 */
router.get('/trigger-sentry-error', (req, res) => {
  const logger = require('../utils/logger');
  logger.info('🚨 Manually triggering Sentry error for DSN verification...');
  
  // Create a real exception to be caught by Sentry middleware or explicit capture
  try {
    throw new Error('Sovereign Verification Exception: Testing SENTRY_DSN Configuration');
  } catch (error) {
    if (process.env.SENTRY_DSN) {
      const Sentry = require('@sentry/node');
      Sentry.captureException(error);
      res.status(500).json({
        success: true,
        message: 'Exception triggered and sent to Sentry.',
        error: error.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'SENTRY_DSN not configured, nothing to send.'
      });
    }
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
 * /api/health/uptime:
 *   get:
 *     summary: Simple uptime check (always returns 200 OK)
 *     tags: [Health]
 */
router.get('/uptime', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'running'
  });
});

/**
 * @swagger
 * /api/health/debug-redis:
 *   get:
 *     summary: Debug Redis configuration (for troubleshooting)
 *     tags: [Health]
 */
router.get('/debug-redis', (req, res) => {
  // SIMPLE endpoint - just reads process.env.REDIS_URL directly
  // NO function calls, NO requires, NO dependencies
  try {
    const rawRedisUrl = process.env.REDIS_URL || '';
    const redisUrl = rawRedisUrl.trim();
    
    // Simple inline masking
    let masked = null;
    if (rawRedisUrl) {
      try {
        masked = rawRedisUrl.replace(/:([^:@]+)@/, ':****@');
      } catch (e) {
        masked = 'error-masking';
      }
    }
    
    res.json({
      success: true,
      environment: process.env.NODE_ENV || 'unknown',
      redisUrl: {
        exists: !!rawRedisUrl && rawRedisUrl.length > 0,
        length: rawRedisUrl.length,
        firstChars: rawRedisUrl.length > 0 ? rawRedisUrl.substring(0, Math.min(30, rawRedisUrl.length)) : null,
        lastChars: rawRedisUrl.length > 30 ? '...' + rawRedisUrl.substring(rawRedisUrl.length - 20) : null,
        masked: masked,
        hasQuotes: rawRedisUrl ? (rawRedisUrl.startsWith('"') || rawRedisUrl.startsWith("'") || rawRedisUrl.endsWith('"') || rawRedisUrl.endsWith("'")) : false,
        hasSpaces: rawRedisUrl ? rawRedisUrl.trim() !== rawRedisUrl : false,
        containsLocalhost: rawRedisUrl ? (rawRedisUrl.includes('localhost') || rawRedisUrl.includes('127.0.0.1')) : false,
        startsWithRedis: redisUrl ? (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')) : false,
        isValid: redisUrl ? (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')) && !redisUrl.includes('localhost') && !redisUrl.includes('127.0.0.1') : false,
      },
      redisHost: process.env.REDIS_HOST || null,
      redisPort: process.env.REDIS_PORT || null,
      redisPassword: process.env.REDIS_PASSWORD ? '***' : null,
    });
  } catch (error) {
    // Even on error, return basic info
    res.json({
      success: false,
      error: error.message,
      redisUrl: {
        exists: !!process.env.REDIS_URL,
        length: process.env.REDIS_URL ? process.env.REDIS_URL.length : 0,
      },
    });
  }
});

/**
 * @swagger
 * /api/health/error-log:
 *   post:
 *     summary: Log client-side unhandled errors
 *     tags: [Health]
 */
router.post('/error-log', (req, res) => {
  try {
    const errorData = req.body || {};
    logger.error('Client-side UI Exception Detected', {
      source: 'client_telemetry',
      url: errorData.url,
      agent: errorData.userAgent,
      errorName: errorData.error,
      errorMessage: errorData.message,
      stack: errorData.stack,
      componentStack: errorData.componentStack
    });

    // Optionally capture in Sentry if configured
    if (process.env.SENTRY_DSN) {
      try {
        const { captureException } = require('../utils/sentry');
        const err = new Error(errorData.message || 'Unknown Client Error');
        err.name = errorData.error || 'ClientError';
        err.stack = errorData.stack;
        captureException(err, { 
          tags: { source: 'client_ui' },
          extra: { 
            componentStack: errorData.componentStack, 
            url: errorData.url, 
            userAgent: errorData.userAgent 
          } 
        });
      } catch (e) {
        // Silently fail Sentry if not available
      }
    }

    res.status(200).json({ success: true, message: 'Telemetry received safely' });
  } catch (err) {
    logger.error('Failed to parse client telemetry', { error: err.message });
    res.status(500).json({ success: false });
  }
});

module.exports = router;

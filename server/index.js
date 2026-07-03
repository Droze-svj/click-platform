const logger = require('./utils/logger');

// Log that we're starting
logger.info('🚀 Starting server...');
logger.info('📝 Node version: ' + process.version);
logger.info('📝 Working directory: ' + process.cwd());
logger.info('📝 PORT environment variable: ' + (process.env.PORT || 'NOT SET (will use 5001)'));
logger.info('📝 NODE_ENV (before .env): ' + (process.env.NODE_ENV || 'NOT SET'));

// Load environment variables FIRST before anything else.
// Always load from project root (parent of server/) so it works when run via `node index.js` from server/ or `npm start` from root.
logger.info('📦 Loading environment variables...');
const path = require('path');
const fs = require('fs'); // Moved fs require here as it's needed for dotenv loading
const rootEnv = path.normalize(path.resolve(__dirname, '..', '.env.nosync'));
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config({ path: path.normalize(path.resolve(__dirname, '..', '.env')) });
}
// Optional: override with .env.local.nosync at root if present
const localEnv = path.normalize(path.resolve(__dirname, '..', '.env.local.nosync'));
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
} else {
  require('dotenv').config({ path: path.normalize(path.resolve(__dirname, '..', '.env.local')) });
}
logger.info('✅ Environment variables loaded');
logger.info('📝 NODE_ENV (after .env): ' + (process.env.NODE_ENV || 'NOT SET (defaulting to development behavior)'));

// Initialize logger early (needed for error handlers)
// logger is already required at the top

const isProductionLikeEnv = () => process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      integrations: [],
    });
    logger.info('✅ Sentry error tracking initialized');
  } catch (sentryInitErr) {
    // Fail LOUD in prod: a silent Sentry=null means crashes vanish unseen.
    const msg = '⚠️ Sentry initialization FAILED — error tracking is OFF';
    if (isProductionLikeEnv()) logger.error(`${msg} (PRODUCTION — fix SENTRY_DSN/network)`, { error: sentryInitErr.message });
    else logger.warn(`${msg} — continuing without it`, { error: sentryInitErr.message });
    Sentry = null;
  }
} else if (isProductionLikeEnv()) {
  // SENTRY_DSN unset on a deployed host = no crash/error visibility. Loud, not info.
  logger.error('❌ SENTRY_DSN is not set in PRODUCTION — crash/error visibility is OFF. Set SENTRY_DSN.');
} else {
  logger.info('ℹ️ SENTRY_DSN not set — error tracking disabled');
}

// Global error handlers - must be after Sentry initialization
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', { error: error.message, stack: error.stack });
  if (Sentry) {
    try {
      Sentry.captureException(error, {
        tags: { type: 'uncaught_exception' },
        level: 'fatal'
      });
    } catch (sentryErr) {
      // Ignore Sentry errors
    }
  }

  // In production, exit after logging to prevent undefined behavior
  // In development, continue to allow debugging
  if (process.env.NODE_ENV === 'production') {
    logger.error('⚠️ Uncaught exception in production - exiting to prevent undefined behavior');
    process.exit(1);
  } else {
    logger.warn('⚠️ Attempting to start server despite error (development mode)...');
  }
});

process.on('unhandledRejection', (reason, promise) => {
  // Filter out Redis localhost connection errors - these are expected when REDIS_URL is not set
  if (reason && typeof reason === 'object' && reason.message &&
    reason.message.includes('ECONNREFUSED') && reason.message.includes('127.0.0.1:6379')) {
    // These are expected when REDIS_URL is not configured - workers will be closed automatically
    // Don't spam logs with these errors
    return;
  }

  logger.error('❌ Unhandled Rejection', {
    reason: reason?.message || String(reason),
    stack: reason?.stack,
    promise: promise?.toString?.() || String(promise)
  });

  if (Sentry) {
    try {
      Sentry.captureException(reason, {
        tags: { type: 'unhandled_rejection' },
        extra: { promise: promise?.toString?.() || String(promise) }
      });
    } catch (sentryErr) {
      // Ignore Sentry errors
    }
  }

  // Log warning but don't exit - unhandled rejections are less critical than uncaught exceptions
  logger.warn('⚠️ Unhandled rejection detected - server will continue');
});

// Start minimal health check server (production/staging only).
// In local dev, this extra server can race with nodemon restarts and cause EADDRINUSE / partial startup.
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

// Detect if we're running locally (not on cloud platforms)
// Health check server should ONLY run on actual cloud deployments, not localhost
const isCloudPlatform = !!(process.env.RENDER || process.env.HEROKU || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const __isHosted = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') && isCloudPlatform;
// Fail-closed misconfig check: loudly flag a deployed host whose NODE_ENV is
// unset/dev/test (which would silently leave non-production gates active). See
// server/utils/env.js for the canonical env predicates.
require('./utils/env').assertDeployedEnvSane(logger);

// C2PA signer availability — CLAUDE.md mandates strict provenance signing. Alert
// LOUDLY at boot if no signer (c2pa-node / c2patool) is present, so an operator
// knows renders will ship unsigned (and get queued for async re-sign) until fixed.
require('./services/c2paService').verifyC2paTools().then((c) => {
  if (c && !c.available) {
    const m = `[c2pa] NO signer available (${c.error}) — renders will ship UNSIGNED (queued for re-sign) until c2patool/c2pa-node is installed.`;
    if (isProductionLikeEnv()) logger.error('❌ ' + m); else logger.warn('⚠️ ' + m);
  } else if (c) {
    logger.info(`✅ C2PA signer available: ${c.signer}${c.version ? ' ' + c.version : ''}`);
  }
}).catch(() => { /* never block boot on the probe */ });

let healthCheckServer = null;
if (__isHosted) {
  logger.info(`📝 Starting health check server on port ${PORT}...`);
  try {
    // Use Node's built-in http module - no dependencies, always available
    const http = require('http');

    const healthCheckHandler = (req, res) => {
      const url = req.url || '/';
      if (url === '/api/health' || url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'starting',
          message: 'Server is initializing...',
          port: PORT,
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'starting',
          message: 'Server is initializing...',
          port: PORT
        }));
      }
    };

    healthCheckServer = http.createServer(healthCheckHandler);

    healthCheckServer.listen(PORT, HOST, () => {
      logger.info(`✅ Health check server bound to port ${PORT} on ${HOST}`);
      logger.info(`✅ Port ${PORT} is now open - Render.com can detect it`);
      logger.info(`✅ Health check available at http://${HOST}:${PORT}/api/health`);
    });

    healthCheckServer.on('error', (err) => {
      logger.error('❌ Health check server error:', err);
      if (err.code === 'EADDRINUSE') {
        logger.error('⚠️ Port is already in use. This might be from a previous deployment.');
      }
      // Don't exit - let the process continue
    });

    // Keep server alive
    healthCheckServer.keepAliveTimeout = 65000;
    healthCheckServer.headersTimeout = 66000;

  } catch (healthError) {
    logger.error('❌ CRITICAL: Failed to start health check server:', { error: healthError.message, stack: healthError.stack });
    // This is critical in hosted environments, but don't exit - let the main server try to start
  }
} else {
  logger.info('📝 Dev mode: skipping separate health check server (starting Express directly)');
}

// Initialize middleware variables at top level to ensure scope availability
let apiOptimizer = null;
let apmMiddleware = null;
let redisCache = null;
let databaseOptimizer = null;

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const compression = require('compression');
const { securityHeaders, customSecurityHeaders } = require('./middleware/securityHeaders');
const cron = require('node-cron');
const swaggerUi = require('swagger-ui-express');
let swaggerSpec = null;
try {
  swaggerSpec = require('./config/swagger');
} catch (err) {
  logger.warn('Swagger docs disabled (missing z-schema?). Run: npm install z-schema', { error: err.message });
  swaggerSpec = { openapi: '3.0.0', info: { title: 'Click API', version: '1.0.0' }, paths: {} };
}
const validateEnv = require('./middleware/validateEnv');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initErrorHandlers } = require('./middleware/enhancedErrorHandler');
const { apiLimiter } = require('./middleware/enhancedRateLimiter');
const requestLogger = require('./middleware/requestLogger');
const { requestTimeoutRouteAware, getTimeoutForRoute } = require('./middleware/requestTimeout');
const { cleanupOldFiles, cleanupTempFiles } = require('./utils/fileCleanup');
// logger is already imported above (needed for error handlers)
const { initializeSocket } = require('./services/socketService');
// const { trackResponseTime } = require('./utils/performance');

// Sentry is already initialized at the top of the file (before error handlers)
// Don't initialize again to avoid duplicate initialization
// // // const { maskSensitiveData } = require('../utils/dataEncryption');
// initSentry();

// Initialize Email Service
try {
  const { initEmailService } = require('./services/emailService');
  initEmailService();
  logger.info('✅ Email service initialized');
} catch (error) {
  logger.warn('Email service initialization failed', { error: error.message });
}

// Initialize Cache Service (Simplified for dev)
logger.info('INITIALIZING CACHE');
const { initCache } = require('./services/cacheService');
initCache().then(() => logger.info('✅ Cache initialized')).catch(err => {
  logger.warn('Cache initialization failed', { error: err.message });
});

// Production-only / Expensive Services
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  // Initialize Intelligent Cache Service
  try {
    const { initIntelligentCache } = require('./services/intelligentCacheService');
    initIntelligentCache();
    logger.info('✅ Intelligent cache service initialized');
  } catch (error) {
    logger.warn('Intelligent cache service initialization failed', { error: error.message });
  }

  // Initialize Redis Cache Service
  try {
    redisCache = require('./utils/redisCache');
    logger.info('✅ Redis cache service initialized');
  } catch (error) {
    logger.warn('Redis cache service initialization failed', { error: error.message });
    redisCache = null;
  }

  // Initialize APM (Application Performance Monitoring)
  try {
    const { apmMonitor, apmMiddleware: apmMiddlewareExport } = require('./utils/apm');
    global.apmMonitor = apmMonitor;
    apmMiddleware = apmMiddlewareExport;
    logger.info('✅ APM monitoring service initialized');
  } catch (error) {
    logger.warn('APM monitoring service initialization failed', { error: error.message });
    global.apmMonitor = null;
    apmMiddleware = null;
  }

  // Initialize Alerting System
  try {
    const alertingSystem = require('./utils/alerting');
    global.alertingSystem = alertingSystem;
    logger.info('✅ Alerting system initialized');
  } catch (error) {
    logger.warn('Alerting system initialization failed', { error: error.message });
    global.alertingSystem = null;
  }

  // Initialize API Optimization Middleware
  try {
    apiOptimizer = require('./middleware/apiOptimizer');
    logger.info('✅ API optimization middleware loaded');
  } catch (error) {
    logger.warn('API optimization middleware initialization failed', { error: error.message });
    apiOptimizer = null;
  }

  // Initialize Database Optimizer
  try {
    databaseOptimizer = require('./utils/databaseOptimizer');
    logger.info('✅ Database optimizer loaded');
  } catch (error) {
    logger.warn('Database optimizer initialization failed', { error: error.message });
  }
}

// Connect to MongoDB
logger.info('CONNECTING TO MONGODB');
// Connect with retry-and-backoff. Crashing the whole process on a Mongo
// auth/network error puts Render into a fast restart loop — every ~45s
// — and the edge serves 503 to all traffic during the recycle. With
// retry, the HTTP server stays up and /api/health degrades gracefully
// (database.connected: false) until the credential or network issue is
// resolved.
const MONGO_MAX_RETRY_DELAY_MS = 30_000;
const MONGO_MAX_RETRIES = 5;
let mongoRetryDelayMs = 2_000;
let mongoRetryAttempt = 0;
let mongoGaveUp = false;

function connectMongo() {
  if (mongoGaveUp) return Promise.resolve();
  // initDatabases() (called later) already handles MongoDB connection +
  // in-memory fallback in dev. If we fire mongoose.connect here against
  // a bad URI, the failed attempt leaves the default connection in a
  // buffering state that initDatabases can't recover. Skip in dev so the
  // in-memory path takes over cleanly. In production, initDatabases is
  // expected to succeed against the real URI; we still attempt here as
  // belt-and-suspenders.
  if (process.env.NODE_ENV !== 'production') {
    mongoGaveUp = true;
    logger.info('Secondary connectMongo() skipped in dev — initDatabases() owns the connection.');
    return Promise.resolve();
  }
  return mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      logger.info('✅ MongoDB connected successfully');
      logger.info('✅ MongoDB connected successfully');
      mongoRetryDelayMs = 2_000;
      mongoRetryAttempt = 0;
    })
    .catch((err) => {
      // Two log-spam mitigations:
      //  1. Auth failures are unrecoverable without human intervention —
      //     retrying the same bad creds forever just floods the logs. Stop
      //     immediately and let `initDatabases()` fall back to local /
      //     MongoMemoryServer.
      //  2. Even for non-auth errors (network, DNS, timeouts), cap the
      //     total retry count so the loop is bounded.
      const isAuthError = /bad auth|authentication failed|Authentication failed/i.test(err.message || '');
      mongoRetryAttempt += 1;
      const giveUpDueToAuth = isAuthError;
      const giveUpDueToCount = mongoRetryAttempt >= MONGO_MAX_RETRIES;

      logger.error('❌ MongoDB connection error', {
        error: err.message,
        attempt: mongoRetryAttempt,
        maxRetries: MONGO_MAX_RETRIES,
        retryInMs: giveUpDueToAuth || giveUpDueToCount ? 0 : mongoRetryDelayMs,
      });

      if (giveUpDueToAuth || giveUpDueToCount) {
        mongoGaveUp = true;
        const reason = giveUpDueToAuth
          ? 'auth failure — credentials in MONGODB_URI are wrong'
          : `${MONGO_MAX_RETRIES} attempts exhausted`;
        logger.warn(`⚠️  Stopped retrying secondary Mongo connect (${reason}). Primary initDatabases() will provide an in-memory fallback in dev.`);
        return;
      }

      setTimeout(connectMongo, mongoRetryDelayMs);
      mongoRetryDelayMs = Math.min(mongoRetryDelayMs * 2, MONGO_MAX_RETRY_DELAY_MS);
    });
}
connectMongo();

// Non-blocking initialization for remaining services
setImmediate(() => {
  if (process.env.NODE_ENV === 'test') return;

  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

  // Job Queue Workers (optional)
  if (isProduction || process.env.ENABLE_BACKGROUND_JOBS === 'true') {
    // CRITICAL: Skip initialization if REDIS_URL is missing in production to prevent crashes
    const redisUrl = process.env.REDIS_URL?.trim();
    if (isProduction && (!redisUrl || redisUrl === '' || redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1'))) {
      if (redisUrl && (redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1'))) {
        logger.error('❌ REDIS_URL contains localhost/127.0.0.1 in production. This is not allowed.');
        logger.error('❌ Workers will NOT be initialized. Use a cloud Redis service.');
      } else {
        logger.warn('⚠️ Skipping worker initialization: REDIS_URL is missing or invalid for production.');
      }
      return;
    }

    try {
      // Only require if needed
      const { initializeWorkers } = require('./queues');
      initializeWorkers();
      logger.info('✅ Job queue system initialized');
    } catch (err) {
      logger.warn('Workers failed to init', { error: err.message });
    }
  }

  // Cron Jobs & Background metrics (Production-heavy stuff)
  if (isProduction) {
    try {
      const { startSLAMonitoring } = require('./services/slaCronService');
      startSLAMonitoring();

      const { initializeValueTrackingHooks } = require('./services/valueTrackingHooks');
      initializeValueTrackingHooks();

      const { startMonthlyCalculationCron, startTierCheckCron } = require('./services/valueTrackingCronService');
      startMonthlyCalculationCron();
      startTierCheckCron();

      const { scheduleUpgradeChecks } = require('./services/modelVersionManager');
      const { scheduleRolloutIncrements } = require('./services/modelVersionGradualRollout');
      scheduleUpgradeChecks();
      scheduleRolloutIncrements();

      const { scheduleHealthReports } = require('./services/healthReportSchedulerService');
      scheduleHealthReports();

      const { startIngestionCron } = require('./services/platformIngestionCronService');
      startIngestionCron();

      // Master autonomous-mode gate. When DISABLE_CRONS=true or
      // AUTONOMOUS_MODE=off, every background cron stays dormant. This
      // is the kill-switch for debugging and incident response.
      const { autonomousModeEnabled } = require('./utils/cronLock');
      if (autonomousModeEnabled()) {
        // Performance learning cron — every 6h, drain freshly-synced
        // analytics into UserStyleProfile so the prompt builder's
        // `topPerformers` block keeps improving without manual triggers.
        const { startLearningCron } = require('./services/performanceLearningCron');
        startLearningCron();

        // Performance-alert cron — daily, raises ONE honest "you're slipping"
        // notification when a creator's rolling 7-day engagement drops >20% below
        // their own baseline. Read-only on analytics (the 6h cron stays the only
        // EMA writer); same kill-switch + cronLock guards.
        const { startAlertCron } = require('./services/performanceAlertService');
        startAlertCron();

        // OAuth token refresh cron — every 30m, refresh any access token
        // that expires within the next 90m. Without this, scheduled posts
        // queued for off-hours would fail when the token silently expires
        // (Google 1h, Twitter 2h, TikTok 24h, Facebook/LinkedIn 60d).
        const { startTokenRefreshCron } = require('./services/tokenRefreshCron');
        startTokenRefreshCron();

        // Recurring post cron — every 5m, evaluate active RecurringPostTemplates
        // and spawn ScheduledPosts when their next-fire instant has elapsed.
        // The downstream scheduler/worker pipeline takes over from there.
        const { startRecurringPostCron } = require('./services/recurringPostCron');
        startRecurringPostCron();

        // Alert-sweep cron — restores the search/benchmark/audience/repost alert,
        // curation, goal-progress and always-on-library automation that used to
        // live in the never-called jobScheduler.initializeScheduler(). OFF unless
        // ENABLE_ALERT_SWEEPS=true (these raise user notifications + scan all
        // users, so activating them is a deliberate opt-in). cronLock-guarded.
        const { startAlertSweepCron } = require('./services/alertSweepCronService');
        startAlertSweepCron();

        // Trends ingest schedule — pulls REAL web-grounded trends (Claude web
        // search via liveTrendService) per platform into TrendSnapshot on a
        // repeatable BullMQ job. Previously defined but never registered.
        const { registerTrendsIngestSchedule } = require('./jobs/trendsIngestJob');
        registerTrendsIngestSchedule().catch((err) =>
          logger.warn('Trends ingest schedule registration failed', { error: err.message })
        );
      } else {
        logger.info('Autonomous mode disabled (DISABLE_CRONS / AUTONOMOUS_MODE=off). Crons not started.');
      }

      const { initQueryMonitoring } = require('./services/queryPerformanceMonitor');
      initQueryMonitoring();

      const { initElasticsearch } = require('./services/elasticsearchService');
      initElasticsearch().catch(() => { });

      const { initCDN } = require('./services/cdnService');
      initCDN().catch(() => { });

      const { initSharding } = require('./services/databaseShardingService');
      initSharding().catch(() => { });

      logger.info('✅ Advanced background services initialized');
    } catch (err) {
      logger.warn('Background services init failed', { error: err.message });
    }
  }
});

// Initialize error handlers
try {
  initErrorHandlers();
} catch (error) {
  logger.warn('Error handlers initialization failed', { error: error.message });
}

// Initialize alerting service monitoring
if (process.env.NODE_ENV === 'production') {
  const { startMonitoring } = require('./services/alertingService');
  startMonitoring(60000); // Check every minute
  logger.info('✅ Alerting service monitoring started');
}

// Validate environment variables on startup
// Don't exit if in production - log error but continue
try {
  validateEnv();
} catch (error) {
  logger.error('Environment validation error', { error: error.message });
  // In production, continue anyway to see what else might be wrong
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Continuing despite validation errors. Check logs for missing variables.');
  } else {
    throw error;
  }
}

// Fatal boot check — refuse to start in production if the data-layer
// credentials we cannot operate without are missing. Previously the server
// started anyway and only failed on the first DB query, which during a
// live demo presented as an opaque 500 instead of a clear boot failure.
if (process.env.NODE_ENV === 'production') {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error('FATAL: missing required env vars in production', { missing });
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  // Probe Supabase reachability once if configured.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    (async () => {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const probe = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { error: probeErr } = await probe.from('users').select('id').limit(1);
        if (probeErr) {
          logger.error('FATAL: Supabase reachable but query failed', { error: probeErr.message });
          // eslint-disable-next-line no-process-exit
          process.exit(1);
        }
        logger.info('Supabase reachability check passed');
      } catch (err) {
        logger.error('FATAL: Supabase unreachable at boot', { error: err.message });
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }
    })();
  } else {
    logger.info('Supabase not configured. Caching and analytics will run in standalone MongoDB mode.');
  }
}

// Initialize production configuration if in production
if (process.env.NODE_ENV === 'production') {
  const { initProduction } = require('./config/production');
  try {
    initProduction();
  } catch (error) {
    logger.error('Production initialization failed', { error: error.message });
    logger.warn('Continuing without production config. Server will still start.');
    // Don't exit - allow server to start even if production config fails
  }
}

const app = express();

// Export the express app for tests (supertest, jest). The script-mode boot
// at the bottom (listen, crons, sockets) still runs when this file is the
// node entrypoint (`node server/index.js`). Putting the export here means
// supertest can attach immediately without waiting on the boot block.
module.exports = app;

// Auth/API responses must not be served as 304 (ETag cache hits) because the client expects a JSON body.
// Disabling ETag generation prevents Express from returning "Not Modified" for API JSON routes like /api/auth/me.
app.set('etag', false);

// EARLIEST POSSIBLE request logging - must be first to catch ALL requests
app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/api')) {
    // Only log in development to avoid log spam in production
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Early request', {
        method: req.method,
        path: req.path,
        host: req.headers.host,
        origin: req.headers.origin,
        ip: req.ip
      });
    }
  }
  next();
});

// #region agent log
// Backend request probe: capture high-signal browser/API traffic even if the frontend bypasses the Next.js /api proxy.
// Never log secrets (no tokens/cookies).
app.use('/api', (req, res, next) => {
  try {
    const p = req.path || '';
    const should =
      p.startsWith('/auth') ||
      p.startsWith('/debug') ||
      p.startsWith('/notifications') ||
      p.startsWith('/approvals') ||
      p.startsWith('/search') ||
      p.startsWith('/onboarding');
    if (should) {
      // Debug instrumentation disabled
    }
  } catch (err) {
    // Silent fail for logging errors
  }
  next();
});
// #endregion

// EARLY request tracing for debugging (must run before CSRF/body parsing/etc).
// This is intentionally lightweight and only targets the endpoints that were timing out.
app.use('/api', (req, res, next) => {
  const p = req.path || '';
  if (
    p.startsWith('/notifications') ||
    p.startsWith('/approvals') ||
    p.startsWith('/search') ||
    p.startsWith('/onboarding') ||
    p.startsWith('/auth/me')
  ) {
    const start = Date.now();
    const startPath = req.path;
    // #region agent log
    // #endregion
    res.on('finish', () => {
      // #region agent log
      // #endregion
    });
  }
  next();
});

// Additional API request logging (this is redundant but kept for backward compatibility)
app.use('/api', (req, res, next) => {
  // This should already be logged by the early middleware above, but keep for safety
  next();
});

// Compression middleware
app.use(compression());

// Security headers (must be before other middleware)
app.use(securityHeaders());
app.use(customSecurityHeaders);

// Enhanced security middleware - Input sanitization
// NOTE: sanitizeInput is applied AFTER the body parsers (see below, post
// express.json/urlencoded) — it sanitizes req.body, which doesn't exist yet at
// this point in the chain. Mounting it here left request bodies unsanitized.
const { sanitizeInput } = require('./middleware/inputSanitization');

// CSRF Protection (after body parsing) - temporarily disabled for auth testing
// const { csrfProtection } = require('./middleware/csrfProtection');
// #region agent log
// #endregion
// app.use('/api', csrfProtection);

// CORS middleware - must be configured before routes
const allowedOrigins = [];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
// Always allow localhost for development and testing
allowedOrigins.push(
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3010',
  'http://localhost:3011',
  'http://localhost:3012',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3010',
  'http://127.0.0.1:3011',
  'http://127.0.0.1:3012'
);
// Allow production frontend if different
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push('https://click-platform.onrender.com');
  // SECURITY: replaced the broad /^https:\/\/.*\.onrender\.com$/ wildcard — it
  // let ANY Render-hosted app send CREDENTIALED cross-origin requests (onrender
  // subdomains are open to public signup). Add extra production origins
  // (preview deploys, custom domains) explicitly via the CORS_ALLOWED_ORIGINS
  // env var (comma-separated) instead.
  if (process.env.CORS_ALLOWED_ORIGINS) {
    process.env.CORS_ALLOWED_ORIGINS
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((o) => allowedOrigins.push(o));
  }
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    })) {
      callback(null, true);
    } else {
      // Log for debugging
      logger.warn('CORS blocked origin', { origin, allowedOrigins: allowedOrigins.map(o => typeof o === 'string' ? o : o.toString()) });
      // In development, allow all localhost origins for easier debugging
      if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        logger.info('Allowing localhost origin in development', { origin });
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Auth-Token',
    'Cache-Control',
    'Pragma',
    // Custom request headers the client sends. These need to be in the
    // CORS allowlist for cross-origin XHRs to pass preflight. With the
    // same-origin Next proxy these never tripped a preflight, but going
    // direct (localhost:3010 → localhost:5001) the browser checks each
    // one against this list. Missing entries → 'Network Error' with no
    // useful response body.
    'X-Click-Language',
    'x-click-language',
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-Total-Count',
    'X-Page-Count'
  ],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Performance tracking middleware
const trackPerformance = require('./middleware/performanceTracking');
app.use(trackPerformance);

// Feature flags middleware
const { featureFlagsMiddleware } = require('./services/featureFlagsService');
app.use(featureFlagsMiddleware);

// API versioning
const { apiVersioning } = require('./middleware/apiVersioning');
app.use('/api', apiVersioning);

// Request timeout (route-aware: 30s default, 5min upload, 10min video/export)
app.use(requestTimeoutRouteAware(parseInt(process.env.REQUEST_TIMEOUT, 10) || getTimeoutForRoute('default')));

// Request logging (before other middleware)
app.use(requestLogger);

// Whop webhook MUST mount BEFORE the global express.json() so the HMAC
// signature verifies against the unparsed body. Scoped to its own path
// so no other route is affected.
app.use(
  '/api/webhooks/whop',
  express.raw({ type: 'application/json', limit: '1mb' }),
  require('./routes/webhooks/whop')
);

// Resumable (tus) uploads MUST mount BEFORE express.json() so tus receives the
// raw chunk stream, and via app.all (not a sub-router) so req.url keeps its full
// path for tus's upload-id parsing. Auth runs first to populate req.user.
try {
  const { tusServer } = require('./routes/upload-tus');
  const tusAuth = require('./middleware/auth');
  const tusHandler = (req, res) => {
    res.setHeader('Access-Control-Expose-Headers', 'Location, Upload-Offset, Upload-Length, Tus-Resumable, X-Content-Id');
    return tusServer.handle(req, res);
  };
  app.all('/api/upload/tus', tusAuth, tusHandler);
  app.all('/api/upload/tus/*', tusAuth, tusHandler);
  logger.info('🧩 Resumable (tus) upload endpoint mounted at /api/upload/tus');
} catch (err) {
  logger.warn('tus upload endpoint not mounted', { error: err.message });
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize inputs AFTER body parsing so req.body (not just query/params) is
// actually cleaned. (Mounting this before the parsers left bodies unsanitized.)
app.use(sanitizeInput);

// Request ID middleware
const { addRequestId } = require('./middleware/requestId');
app.use(addRequestId);

// Language detection — exposes req.language + req.languageLabel for AI prompts
app.use(require('./middleware/language'));

// Dev mode flag – available to all routes (auth also sets it for authenticated requests)
const { allowDevMode } = require('./utils/devUser');
app.use((req, res, next) => {
  req.allowDevMode = allowDevMode(req);
  next();
});

// Targeted request timing for debugging (avoid logging secrets)
app.use('/api', (req, res, next) => {
  const p = req.path || '';
  if (
    p.startsWith('/notifications') ||
    p.startsWith('/approvals') ||
    p.startsWith('/search') ||
    p.startsWith('/onboarding') ||
    p.startsWith('/auth/me')
  ) {
    const start = Date.now();
    // #region agent log
    // #endregion
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      // #region agent log
      // #endregion
    });
  }
  next();
});

// Rate limiting (applied to API routes)
// In local development, rate limiting can break the app (429 storms) and also blocks our debug relay.
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  app.use('/api', apiLimiter);
}

// API Optimization Middleware (compression, caching, performance)
// apiOptimizer is an array of middlewares - Express handles this automatically
if (apiOptimizer && Array.isArray(apiOptimizer) && apiOptimizer.length > 0) {
  // Express accepts arrays of middlewares - apply all at once
  app.use('/api', apiOptimizer);
}

// APM Middleware for performance monitoring
if (apmMiddleware) {
  app.use('/api', apmMiddleware);
}

// Cache middleware for GET requests.
//
// Skip-list for endpoints whose data mutates on user actions and MUST
// return fresh data on every request. The previous list only skipped
// `/auth/me` and `/status`, which meant /api/style-profile,
// /api/video/clips/style-insight, /api/analytics/*, and others returned
// 5-minute-old data after a publish — so users saw "totalPicks=0" right
// after the learning loop wrote totalPicks=3, until the TTL expired.
// Honest UX is "your action is reflected immediately."
const CACHE_SKIP_PATHS = [
  '/auth/me',
  '/auth/profile',
  '/status',
  '/style-profile',
  '/video/clips/style-insight',
  '/video/clips/hub',
  '/analytics',
  '/notifications',
  '/posts',
  '/scheduler',
  '/drafts',
  '/billing',
  '/subscription',
  '/integrations',
  '/oauth/connections',
  '/user/',
  '/settings',
];
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET') return next();
  const path = req.path || '';
  if (CACHE_SKIP_PATHS.some((p) => path.includes(p))) return next();
  const { cacheMiddleware } = require('./middleware/cacheMiddleware');
  return cacheMiddleware(300)(req, res, next); // 5 minutes cache
});

app.get('/api/test-mi', (req, res) => res.json({ success: true, message: 'MI test route works' }));

// Serve a simple landing page for testing - MUST BE BEFORE OTHER ROUTES
app.get('/', (req, res, nextMw) => {
  // In production the Next.js frontend owns "/" (served by the catch-all below).
  // This debug/status landing page is dev-only.
  if (process.env.NODE_ENV === 'production') return nextMw();
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Click Platform - Test Your APIs</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 40px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
        }
        h1 {
            text-align: center;
            margin-bottom: 10px;
            font-size: 3em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .subtitle {
            text-align: center;
            margin-bottom: 40px;
            font-size: 1.2em;
            opacity: 0.9;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        .card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
        }
        .card h3 {
            margin-top: 0;
            color: #fff;
            font-size: 1.5em;
        }
        .card p {
            margin-bottom: 20px;
            opacity: 0.9;
        }
        .btn {
            display: inline-block;
            background: #4f46e5;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            transition: background 0.3s ease;
            border: none;
            cursor: pointer;
            font-size: 16px;
        }
        .btn:hover {
            background: #3730a3;
        }
        .btn.secondary {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .btn.secondary:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status.online {
            background: #10b981;
            color: white;
        }
        .code {
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            margin: 15px 0;
            overflow-x: auto;
        }
        .api-test {
            margin-top: 30px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
        }
        .endpoint {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
            padding: 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
        }
        .method {
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
        }
        .method.get { background: #10b981; }
        .method.post { background: #f59e0b; }
        .method.put { background: #3b82f6; }
        .method.delete { background: #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Click Platform</h1>
        <p class="subtitle">Your AI-powered content creation platform is ready for testing!</p>

        <div style="text-align: center; margin-bottom: 30px;">
            <span class="status online">✓ API Status: Online</span>
        </div>

        <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: rgba(255, 255, 255, 0.1); border-radius: 10px;">
            <h3 style="color: white; margin-bottom: 10px;">🧪 Button Test</h3>
            <button onclick="alert('Buttons are working!')" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">Test Alert</button>
            <button onclick="console.log('Console test - check browser dev tools')" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">Test Console</button>
        </div>

        <div class="grid">
            <div class="card">
                <h3>🔐 Authentication</h3>
                <p>Test user registration, login, and email verification.</p>
                <button id="show-register-btn" class="btn">Test Registration</button>
                <button id="show-login-btn" class="btn secondary">Test Login</button>
            </div>
        </div>

        <div id="auth-forms" style="display: none; margin: 30px auto; max-width: 600px; padding: 20px; background: rgba(255, 255, 255, 0.1); border-radius: 10px;">
            <h3 id="form-title" style="color: white; text-align: center;">Register</h3>
            <form id="register-form" style="max-width: 400px; margin: 0 auto;">
                <div style="margin-bottom: 15px;">
                    <input type="email" id="reg-email" placeholder="Email" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="password" id="reg-password" placeholder="Password" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="reg-name" placeholder="Full Name" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
                </div>
                <button type="submit" class="btn" style="width: 100%;">Register</button>
            </form>

            <form id="login-form" style="max-width: 400px; margin: 0 auto; display: none;">
                <div style="margin-bottom: 15px;">
                    <input type="email" id="login-email" placeholder="Email" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="password" id="login-password" placeholder="Password" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
                </div>
                <button type="submit" class="btn" style="width: 100%;">Login</button>
            </form>

            <div id="auth-result" style="margin-top: 20px; padding: 15px; border-radius: 5px; display: none;"></div>
        </div>

        <div class="grid">

            <div class="card">
                <h3>📝 Content Creation</h3>
                <p>Create, edit, and manage your content posts.</p>
                <button id="view-posts-btn" class="btn">View Posts</button>
                <button id="create-post-btn" class="btn secondary">Create Post</button>
            </div>

            <div class="card">
                <h3>📊 Analytics Dashboard</h3>
                <p>Track performance and engagement metrics.</p>
                <button id="view-analytics-btn" class="btn">View Analytics</button>
                <button id="view-performance-btn" class="btn secondary">Performance</button>
            </div>

            <div class="card">
                <h3>🔗 Social Integration</h3>
                <p>Connect and post to social media platforms.</p>
                <button id="connect-twitter-btn" class="btn">Connect Twitter</button>
                <button id="view-connections-btn" class="btn secondary">View Connections</button>
            </div>

            <div class="card">
                <h3>👑 Admin Panel</h3>
                <p>Manage users and system settings.</p>
                <button id="admin-stats-btn" class="btn">System Stats</button>
                <button id="admin-users-btn" class="btn secondary">User Management</button>
            </div>

            <div class="card">
                <h3>🔧 API Testing</h3>
                <p>Use these endpoints to test functionality.</p>
                <button onclick="testHealth()" class="btn">Test Health</button>
                <button onclick="testMe()" class="btn secondary">Test Auth</button>
            </div>
        </div>

        <div class="api-test">
            <h3>🧪 Quick API Tests</h3>
            <p>Click the buttons above or use these curl commands:</p>

            <div class="code">
curl -s https://click-platform.onrender.com/api/health
            </div>

            <div class="endpoint">
                <span><span class="method get">GET</span> /api/health</span>
                <span>Check API status</span>
            </div>

            <div class="endpoint">
                <span><span class="method post">POST</span> /api/auth/register</span>
                <span>Register new user</span>
            </div>

            <div class="endpoint">
                <span><span class="method post">POST</span> /api/auth/login</span>
                <span>User login</span>
            </div>

            <div class="endpoint">
                <span><span class="method get">GET</span> /api/posts</span>
                <span>Get user posts</span>
            </div>

            <div class="endpoint">
                <span><span class="method get">GET</span> /api/analytics/dashboard</span>
                <span>View analytics</span>
            </div>
        </div>


        <div style="text-align: center; margin-top: 40px; opacity: 0.8;">
            <p>💡 <strong>Next Steps:</strong> Full React frontend deployment coming soon!</p>
            <p>For now, test all your APIs and backend functionality here.</p>
        </div>
    </div>

    <script>
        let authToken = null;

        async function testHealth() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                alert('✅ API is working!\\n\\n' + JSON.stringify(data, null, 2));
            } catch (error) {
                alert('❌ API test failed: ' + error.message);
            }
        }

        function showRegistrationForm() {
            console.log('Registration button clicked');

            // Debug DOM element existence
            const authForms = document.getElementById('auth-forms');
            const formTitle = document.getElementById('form-title');
            const registerForm = document.getElementById('register-form');
            const loginForm = document.getElementById('login-form');
            const authResult = document.getElementById('auth-result');

            console.log('DOM elements found:', {
                authForms: !!authForms,
                formTitle: !!formTitle,
                registerForm: !!registerForm,
                loginForm: !!loginForm,
                authResult: !!authResult
            });

            // Apply changes with verification
            if (authForms) {
                authForms.style.display = 'block';
                console.log('Set auth-forms display to block, computed style:', window.getComputedStyle(authForms).display);
                console.log('auth-forms visibility:', window.getComputedStyle(authForms).visibility);
                console.log('auth-forms opacity:', window.getComputedStyle(authForms).opacity);
                console.log('auth-forms parent display:', authForms.parentElement ? window.getComputedStyle(authForms.parentElement).display : 'no parent');

                // Scroll the form into view smoothly
                setTimeout(() => {
                    authForms.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            } else {
                console.error('auth-forms element not found!');
            }

            if (formTitle) {
                formTitle.textContent = 'Register';
                console.log('Set form-title text to Register, actual text:', formTitle.textContent);
                console.log('form-title display:', window.getComputedStyle(formTitle).display);
            } else {
                console.error('form-title element not found!');
            }

            if (registerForm) {
                registerForm.style.display = 'block';
                console.log('Set register-form display to block, computed style:', window.getComputedStyle(registerForm).display);
                console.log('register-form visibility:', window.getComputedStyle(registerForm).visibility);
                console.log('register-form parent display:', registerForm.parentElement ? window.getComputedStyle(registerForm.parentElement).display : 'no parent');
            } else {
                console.error('register-form element not found!');
            }

            if (loginForm) {
                loginForm.style.display = 'none';
                console.log('Set login-form display to none, computed style:', window.getComputedStyle(loginForm).display);
            } else {
                console.error('login-form element not found!');
            }

            if (authResult) {
                authResult.style.display = 'none';
                console.log('Set auth-result display to none, computed style:', window.getComputedStyle(authResult).display);
            } else {
                console.error('auth-result element not found!');
            }

            // Force a reflow and check final state
            setTimeout(() => {
                console.log('After timeout - auth-forms computed display:', authForms ? window.getComputedStyle(authForms).display : 'element gone');
                console.log('After timeout - register-form computed display:', registerForm ? window.getComputedStyle(registerForm).display : 'element gone');

                // Try to force visibility with !important-like behavior
                if (authForms) {
                    authForms.style.setProperty('display', 'block', 'important');
                    authForms.style.visibility = 'visible';
                    authForms.style.opacity = '1';
                    console.log('FORCED visibility changes applied');
                }
                if (registerForm) {
                    registerForm.style.setProperty('display', 'block', 'important');
                    registerForm.style.visibility = 'visible';
                    registerForm.style.opacity = '1';
                    console.log('FORCED register-form visibility changes applied');
                }

                    // Check for potential CSS conflicts
                if (authForms) {
                    const authFormsRect = authForms.getBoundingClientRect();
                    console.log('auth-forms bounding rect:', {
                        width: authFormsRect.width,
                        height: authFormsRect.height,
                        top: authFormsRect.top,
                        left: authFormsRect.left
                    });
                    console.log('auth-forms is visible in viewport:', authFormsRect.top >= 0 && authFormsRect.left >= 0 && authFormsRect.width > 0 && authFormsRect.height > 0);

                    // Force visibility check
                    console.log('auth-forms offsetWidth:', authForms.offsetWidth);
                    console.log('auth-forms offsetHeight:', authForms.offsetHeight);
                    console.log('auth-forms clientWidth:', authForms.clientWidth);
                    console.log('auth-forms clientHeight:', authForms.clientHeight);
                }

                // Also check if the form is actually in the DOM and visible
                setTimeout(() => {
                    const currentAuthForms = document.getElementById('auth-forms');
                    if (currentAuthForms) {
                        console.log('Final check - auth-forms display:', window.getComputedStyle(currentAuthForms).display);
                        console.log('Final check - auth-forms visibility:', window.getComputedStyle(currentAuthForms).visibility);
                        console.log('Final check - auth-forms opacity:', window.getComputedStyle(currentAuthForms).opacity);
                        console.log('Can you SEE the form now?', currentAuthForms.offsetWidth > 0 && currentAuthForms.offsetHeight > 0);
                    }
                }, 500);
            }, 100);
        }

        function showLoginForm() {
            document.getElementById('auth-forms').style.display = 'block';
            document.getElementById('form-title').textContent = 'Login';
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('auth-result').style.display = 'none';
        }

        // Handle registration form
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const resultDiv = document.getElementById('auth-result');

            const data = {
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-password').value,
                name: document.getElementById('reg-name').value
            };

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                let result;
                try {
                    result = await response.json();
                } catch (e) {
                    result = { error: 'Invalid response from server' };
                }

                if (response.ok) {
                    resultDiv.style.background = '#10b981';
                    resultDiv.innerHTML = '<strong>✅ Registration Successful!</strong><br>Check your email for verification link.<br><br><strong>JWT Token:</strong><br><code style="background: rgba(0,0,0,0.2); padding: 5px; border-radius: 3px;">' + (result.token || 'Check response below') + '</code><br><br><pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto;">' + JSON.stringify(result, null, 2) + '</pre>';
                    authToken = result.token;
                } else {
                    resultDiv.style.background = '#ef4444';
                    let errorMessage = result.error || 'Unknown error';
                    if (result.details && Array.isArray(result.details)) {
                        errorMessage += '<br><br><strong>Validation Errors:</strong><ul>';
                        result.details.forEach(detail => {
                            errorMessage += '<li>' + detail.msg + ' (field: ' + detail.path + ')</li>';
                        });
                        errorMessage += '</ul>';
                    }
                    resultDiv.innerHTML = '<strong>❌ Registration Failed:</strong><br>' + errorMessage + '<br><br><details><summary>Full Response</summary><pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto;">' + JSON.stringify(result, null, 2) + '</pre></details>';
                }
            } catch (error) {
                resultDiv.style.background = '#ef4444';
                resultDiv.innerHTML = '<strong>❌ Network Error:</strong><br>' + error.message;
            }

            resultDiv.style.display = 'block';
            resultDiv.style.color = 'white';
        });

        // Handle login form
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const resultDiv = document.getElementById('auth-result');

            const data = {
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value
            };

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    resultDiv.style.background = '#10b981';
                    resultDiv.innerHTML = '<strong>✅ Login Successful!</strong><br><br><strong>JWT Token:</strong><br><code style="background: rgba(0,0,0,0.2); padding: 5px; border-radius: 3px; word-break: break-all;">' + result.token + '</code><br><br><button id="copy-token-btn" style="margin-top: 10px; padding: 8px 16px; background: rgba(255,255,255,0.2); border: none; border-radius: 5px; color: white; cursor: pointer;">Copy Token</button><br><br><details><summary>User Info</summary><pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto;">' + JSON.stringify(result.user, null, 2) + '</pre></details>';
                    authToken = result.token;
                    // Add event listener for the dynamically created copy button
                    setTimeout(() => {
                        const copyBtn = document.getElementById('copy-token-btn');
                        if (copyBtn) {
                            copyBtn.addEventListener('click', copyCurrentToken);
                        }
                    }, 100);
                } else {
                    resultDiv.style.background = '#ef4444';
                    let errorMessage = result.error || 'Unknown error';
                    if (result.details && Array.isArray(result.details)) {
                        errorMessage += '<br><br><strong>Validation Errors:</strong><ul>';
                        result.details.forEach(detail => {
                            errorMessage += '<li>' + detail.msg + ' (field: ' + detail.path + ')</li>';
                        });
                        errorMessage += '</ul>';
                    }
                    resultDiv.innerHTML = '<strong>❌ Login Failed:</strong><br>' + errorMessage + '<br><br><details><summary>Full Response</summary><pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto;">' + JSON.stringify(result, null, 2) + '</pre></details>';
                }
            } catch (error) {
                resultDiv.style.background = '#ef4444';
                resultDiv.innerHTML = '<strong>❌ Network Error:</strong><br>' + error.message;
            }

            resultDiv.style.display = 'block';
            resultDiv.style.color = 'white';
        });

        async function testMe() {
            if (!authToken) {
                alert('🔒 Please login first to test authentication.');
                showLoginForm();
                return;
            }

            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + authToken }
                });
                if (response.status === 401) {
                    alert('🔒 Token expired. Please login again.');
                    showLoginForm();
                } else {
                    const data = await response.json();
                    alert('✅ Authentication working!\\n\\nUser: ' + data.email + '\\nRole: ' + (data.role || 'member'));
                }
            } catch (error) {
                alert('❌ Auth test failed: ' + error.message);
            }
        }

        function copyCurrentToken() {
            if (!authToken) {
                alert('❌ No token available to copy!');
                return;
            }
            navigator.clipboard.writeText(authToken).then(() => {
                alert('✅ Token copied to clipboard!');
            }).catch(() => {
                // Fallback for browsers that don't support clipboard API
                const textArea = document.createElement('textarea');
                textArea.value = authToken;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('✅ Token copied to clipboard!');
            });
        }



        async function testEndpoint(endpoint, method = 'GET') {
            if (!authToken && endpoint !== '/api/health') {
                alert('🔒 Please login first to access protected endpoints.');
                showLoginForm();
                return;
            }

            try {
                const headers = { 'Content-Type': 'application/json' };
                if (authToken) {
                    headers['Authorization'] = 'Bearer ' + authToken;
                }

                const response = await fetch(endpoint, {
                    method: method,
                    headers: headers
                });

                let result;
                try {
                    result = await response.json();
                } catch (e) {
                    result = { message: 'No JSON response' };
                }

                if (response.ok) {
                    alert('✅ ' + method + ' ' + endpoint + ' succeeded!\\n\\nStatus: ' + response.status + '\\n\\nResponse:\\n' + JSON.stringify(result, null, 2));
                } else if (response.status === 401) {
                    alert('🔒 ' + method + ' ' + endpoint + ' requires authentication.\\n\\nPlease login first.');
                    showLoginForm();
                } else if (response.status === 403) {
                    alert('🚫 ' + method + ' ' + endpoint + ' requires admin privileges.\\n\\nMake sure you\\'re logged in with an admin account.');
                } else {
                    alert('❌ ' + method + ' ' + endpoint + ' failed.\\n\\nStatus: ' + response.status + '\\nError: ' + (result.error || result.message || 'Unknown error') + '\\n\\nFull Response:\\n' + JSON.stringify(result, null, 2));
                }
            } catch (error) {
                alert('❌ Network error accessing ' + endpoint + ': ' + error.message);
            }
        }

        async function createSamplePost() {
            if (!authToken) {
                alert('🔒 Please login first to create posts.');
                showLoginForm();
                return;
            }

            const postData = {
                title: "My First Click Post",
                content: "Welcome to Click Platform! This is my first automated post created from the web interface.",
                platforms: ["twitter"],
                status: "draft"
            };

            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + authToken
                    },
                    body: JSON.stringify(postData)
                });

                const result = await response.json();

                if (response.ok) {
                    alert('✅ Post created successfully!\\n\\nTitle: ' + result.title + '\\nStatus: ' + result.status + '\\nID: ' + result.id + '\\n\\nFull Response:\\n' + JSON.stringify(result, null, 2));
                } else {
                    alert('❌ Failed to create post.\\n\\nStatus: ' + response.status + '\\nError: ' + (result.error || 'Unknown error') + '\\n\\nFull Response:\\n' + JSON.stringify(result, null, 2));
                }
            } catch (error) {
                alert('❌ Network error creating post: ' + error.message);
            }
        }

        // Add event listeners for buttons - using DOMContentLoaded for reliability
        function attachEventListeners() {
            // #region agent log
            fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'attachEventListeners',
                    message: 'Function called',
                    data: { readyState: document.readyState },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    hypothesisId: 'B'
                })
            }).catch(() => {});
            // #endregion

            // Auth buttons
            const registerBtn = document.getElementById('show-register-btn');
            const loginBtn = document.getElementById('show-login-btn');

            // #region agent log
            fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'attachEventListeners',
                    message: 'Button elements found',
                    data: {
                        registerBtn: !!registerBtn,
                        loginBtn: !!loginBtn
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    hypothesisId: 'C'
                })
            }).catch(() => {});
            // #endregion

            if (registerBtn) {
                registerBtn.addEventListener('click', (e) => {
                    // #region agent log
                    fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            location: 'registerBtn.click',
                            message: 'Register button clicked',
                            data: { buttonId: 'show-register-btn' },
                            timestamp: Date.now(),
                            sessionId: 'debug-session',
                            hypothesisId: 'A'
                        })
                    }).catch(() => {});
                    // #endregion

                    showRegistrationForm();
                });
            }
            if (loginBtn) {
                loginBtn.addEventListener('click', (e) => {
                    // #region agent log
                    fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            location: 'loginBtn.click',
                            message: 'Login button clicked',
                            data: { buttonId: 'show-login-btn' },
                            timestamp: Date.now(),
                            sessionId: 'debug-session',
                            hypothesisId: 'A'
                        })
                    }).catch(() => {});
                    // #endregion

                    showLoginForm();
                });
            }

            // API testing buttons
            const buttons = [
                { id: 'view-posts-btn', action: () => testEndpoint('/api/posts', 'GET') },
                { id: 'create-post-btn', action: createSamplePost },
                { id: 'view-analytics-btn', action: () => testEndpoint('/api/analytics/dashboard', 'GET') },
                { id: 'view-performance-btn', action: () => testEndpoint('/api/analytics/performance', 'GET') },
                { id: 'connect-twitter-btn', action: () => testEndpoint('/api/oauth/twitter', 'GET') },
                { id: 'view-connections-btn', action: () => testEndpoint('/api/oauth/connected-accounts', 'GET') },
                { id: 'admin-stats-btn', action: () => testEndpoint('/api/admin/stats', 'GET') },
                { id: 'admin-users-btn', action: () => testEndpoint('/api/admin/users', 'GET') }
            ];

            buttons.forEach(({ id, action }) => {
                const btn = document.getElementById(id);
                if (btn) {
                    // #region agent log
                    fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            location: 'attachEventListeners',
                            message: 'Attaching listener to button',
                            data: { buttonId: id },
                            timestamp: Date.now(),
                            sessionId: 'debug-session',
                            hypothesisId: 'C'
                        })
                    }).catch(() => {});
                    // #endregion

                    btn.addEventListener('click', action);
                    console.log('Attached listener to button:', id);
                } else {
                    // #region agent log
                    fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            location: 'attachEventListeners',
                            message: 'Button not found',
                            data: { buttonId: id },
                            timestamp: Date.now(),
                            sessionId: 'debug-session',
                            hypothesisId: 'D'
                        })
                    }).catch(() => {});
                    // #endregion

                    console.warn('Button not found:', id);
                }
            });

            console.log('Event listeners attachment completed');
        }

        // Attach listeners when DOM is ready
        if (document.readyState === 'loading') {
            // #region agent log
            fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'DOMContentLoaded',
                    message: 'DOM still loading, adding event listener',
                    data: { readyState: document.readyState },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    hypothesisId: 'E'
                })
            }).catch(() => {});
            // #endregion

            document.addEventListener('DOMContentLoaded', attachEventListeners);
        } else {
            // #region agent log
            fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'DOMContentLoaded',
                    message: 'DOM already loaded, calling attachEventListeners directly',
                    data: { readyState: document.readyState },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    hypothesisId: 'E'
                })
            }).catch(() => {});
            // #endregion

            attachEventListeners();
        }

        // Auto-test health on page load
        window.addEventListener('load', () => {
            // #region agent log
            fetch('http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'window.load',
                    message: 'Page fully loaded',
                    data: {},
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    hypothesisId: 'B'
                })
            }).catch(() => {});
            // #endregion

            setTimeout(testHealth, 1000);
        });
    </script>
</body>
</html>`);
});

// ── Single-URL deployment: serve the Next.js frontend from this process ──
// In production this Express server serves BOTH the API (/api/*) and the
// Next.js app (everything else) on one port/URL. The handler is prepared
// asynchronously at boot; the catch-all middleware (registered just before the
// 404 handler) waits for it. Everything here is defensive: if Next can't be
// loaded or prepared, the API keeps running and non-API routes fall through to
// the normal 404 — the server never crashes because of frontend serving.
let __nextHandler = null;
let __nextReady = Promise.resolve();
function initNextApp() {
  if (process.env.NODE_ENV !== 'production') return Promise.resolve(null);
  const clientDir = path.join(__dirname, '../client');
  if (!fs.existsSync(path.join(clientDir, '.next'))) {
    logger.warn('📦 Next.js build not found at client/.next — frontend will not be served by the API process');
    return Promise.resolve(null);
  }
  let nextFactory;
  try {
    // Prefer the client's own Next install (exact version the build used).
    nextFactory = require(path.join(clientDir, 'node_modules', 'next'));
  } catch {
    try {
      nextFactory = require('next');
    } catch (e) {
      logger.error('📦 Next.js module not available in runtime — cannot serve frontend', { error: e.message });
      return Promise.resolve(null);
    }
  }
  try {
    const nextApp = nextFactory({ dev: false, dir: clientDir });
    const handlerPromise = nextApp.prepare().then(() => {
      __nextHandler = nextApp.getRequestHandler();
      logger.info('🖥️  Next.js frontend ready — serving app + API on one URL');
      return __nextHandler;
    });
    return handlerPromise;
  } catch (e) {
    logger.error('📦 Failed to initialize Next.js frontend serving', { error: e.message });
    return Promise.resolve(null);
  }
}
__nextReady = initNextApp().catch((e) => {
  logger.error('📦 Next.js prepare() failed — frontend not served', { error: e.message });
  return null;
});

// Database connection with multi-provider support
// Supports Supabase, Prisma (PostgreSQL), and MongoDB (legacy)
const { initDatabases, getDatabaseHealth } = require('./config/database');

// Connect to database (supports multiple providers)
const connectDB = async () => {
  try {
    const dbStatus = await initDatabases();

    if (dbStatus.supabase || dbStatus.prisma || dbStatus.mongodb) {
      logger.info('✅ Database connected successfully');
      logger.info('Database status:', getDatabaseHealth());
    } else {
      logger.error('❌ No database connection available');
      logger.warn('⚠️ Server will start in degraded mode. Database features will not work.');
    }
  } catch (err) {
    logger.error('❌ Database connection error:', err);
    logger.warn('⚠️ Server will start without database. Connection will retry in background.');
    // Don't exit - allow server to start
  }
};

// Connect to database (non-blocking) - skip in Jest workers so tests control Mongoose
if (!process.env.JEST_WORKER_ID) {
  connectDB();
}

// API Documentation
const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Click API'
};

// Primary docs route (common Swagger default) - only if swagger loaded
if (swaggerSpec) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}

// Redis Caching Middleware for API routes
// Cache GET requests for better performance
if (redisCache && typeof redisCache.middleware === 'function') {
  app.use('/api', redisCache.middleware({
    ttl: 300, // 5 minutes default
    skipCache: (req) => {
      // Don't cache non-GET requests, auth routes, user-specific data, or uploads
      return req.method !== 'GET' ||
        req.originalUrl.includes('/auth/') ||
        req.originalUrl.includes('/user/') ||
        req.originalUrl.includes('/upload/') ||
        req.originalUrl.includes('/admin/') ||
        req.originalUrl.includes('/batch/') ||
        req.originalUrl.includes('/export/') ||
        req.originalUrl.includes('/notifications') ||
        req.originalUrl.includes('/settings');
    },
    condition: (req) => {
      // Only cache for authenticated users or public routes
      return !!req.user || req.originalUrl.includes('/analytics/');
    }
  }));
}

// Serve static files from uploads directory (for videos, images, etc.).
// Some writers anchor on `process.cwd()/uploads` and others on
// `__dirname/../uploads`, so we mount both to keep URLs working regardless
// of which working directory the server was started from.
// Hardening: dotfiles denied (no serving .env-style files that may land here)
// and directory indexing disabled (no listing of other users' filenames).
// NOTE: this is public/shareable media by design — user-private exports also
// have an authenticated, ownership-checked download route
// (/api/video/render/:jobId/download); output filenames are unguessable.
const STATIC_OPTS = { dotfiles: 'deny', index: false };
// Signed-capability gate (flag-gated REQUIRE_SIGNED_MEDIA, default OFF). When on,
// /uploads/<path> requires a valid ?exp&sig from utils/mediaUrlSigner — so private
// media is no longer anonymously fetchable by anyone who observes the URL. Mounted
// BEFORE the static handlers. See docs/security/private-media-access-plan.md.
app.use('/uploads', require('./middleware/requireSignedMedia'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), STATIC_OPTS));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), STATIC_OPTS));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), STATIC_OPTS));

// Routes
// #region agent log - Route mounting
// #endregion

// Debug middleware for all API requests
app.use('/api', (req, res, next) => {
  // #region agent log - API request received
  // #endregion
  next();
});

// SECURITY (signed media): deep-sign every /uploads URL in API JSON responses at
// ONE global point, so private media always leaves the API as a short-lived
// HMAC-signed capability URL and NO route (current or future, including the video
// sub-routers mounted directly below) can leak an unsigned path. This is what
// makes REQUIRE_SIGNED_MEDIA=true safe to enable: with the gate on, the client
// only ever receives signable URLs. signMediaUrls only rewrites /uploads strings
// (external/CDN/data URLs and non-media payloads pass through) and is idempotent,
// so the per-route signers added earlier remain correct (re-signing is a no-op).
const { signMediaUrls: _signMediaUrls } = require('./utils/mediaUrlSigner');
app.use('/api', (req, res, next) => {
  const _json = res.json.bind(res);
  res.json = (body) => _json(_signMediaUrls(body));
  next();
});

// Debug middleware for quote routes
app.use('/api/quote', (req, res, next) => {
  // #region agent log
  // #endregion
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/pm', require('./routes/pm'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/video', require('./routes/video'));
app.use('/api/content', require('./routes/content'));
app.use('/api/autopilot', require('./routes/autopilot'));
// Revived (Phase F): complete routes the frontend already calls but that were
// never mounted — so those UI features 404'd. Backing services exist; the breadth
// smoke sweep verifies they don't 5xx.
app.use('/api/digital-twin', require('./routes/digitalTwin'));
app.use('/api/retention-heatmap', require('./routes/retention-heatmap'));
app.use('/api/trust', require('./routes/trust'));
app.use('/api/toolbox', require('./routes/toolbox'));
app.use('/api/dubbing', require('./routes/dubbing'));
app.use('/api/quote', require('./routes/quote'));
app.use('/api/scheduler', require('./routes/scheduler'));
app.use('/api/recurring', require('./routes/recurring'));
app.use('/api/drafts', require('./routes/drafts'));
// Analytics routes - more specific first
app.use('/api/analytics/creator', require('./routes/analytics/creator'));
app.use('/api/analytics/content', require('./routes/analytics/content'));
app.use('/api/analytics/performance', require('./routes/analytics/performance'));
app.use('/api/analytics/growth', require('./routes/analytics/growth'));
app.use('/api/analytics/advanced', require('./routes/analytics/advanced'));
app.use('/api/analytics/predictions', require('./routes/analytics/predictions'));
app.use('/api/analytics', require('./routes/analytics'));

app.use('/api/niche', require('./routes/niche'));
app.use('/api/intelligence', require('./routes/intelligence'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/upload/progress', require('./routes/upload/progress'));
app.use('/api/ingest', require('./routes/ingest'));
app.use('/api/marketing-knowledge', require('./routes/marketingKnowledge'));
app.use('/api/marketing-intelligence', require('./routes/marketingIntelligence'));
app.use('/api/style-profile', require('./routes/userStyleProfile'));
app.use('/api/search', require('./routes/search'));
app.use('/api/export', require('./routes/export'));
app.use('/api/batch', require('./routes/batch'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/music', require('./routes/music'));
app.use('/api/music', require('./routes/music-user-uploads'));
// Organized categorized browse + AI generation (fresh LIVE routes — the rest of the
// music-* family stays intentionally KNOWN_DEAD per the security audit).
app.use('/api/music', require('./routes/music-browse'));
app.use('/api/music', require('./routes/music-generate'));
// Saved editor "looks" (filters + grade + audio + caption) — per-user, allowlisted.
app.use('/api/editor', require('./routes/editor-presets'));
app.use('/api/competitive', require('./routes/competitive-benchmark'));
app.use('/api/video/effects', require('./routes/video/effects'));
app.use('/api/video/enhance', require('./routes/video/enhance'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/scripts', require('./routes/scripts'));
app.use('/api/versions', require('./routes/versions'));
app.use('/api/collaboration', require('./routes/collaboration'));
app.use('/api/membership', require('./routes/membership'));
// Canonical entitlements: GET /api/plans (public) + GET /api/me/entitlements (auth)
app.use('/api', require('./routes/entitlements'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/subscription', require('./routes/subscription/status'));
app.use('/api/import', require('./routes/import'));
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/library', require('./routes/library'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/social', require('./routes/social'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/analytics/enhanced', require('./routes/analytics/enhanced'));
app.use('/api/analytics/content-performance', require('./routes/analytics/contentPerformance'));
app.use('/api/analytics/platform', require('./routes/analytics/platform'));
app.use('/api/analytics/bi', require('./routes/analytics/bi'));
app.use('/api/benchmarking', require('./routes/benchmarking'));
app.use('/api/curation', require('./routes/curation'));
app.use('/api/audience', require('./routes/audience'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/help', require('./routes/help-center'));
app.use('/api/templates/marketplace', require('./routes/templates/marketplace'));
app.use('/api/collaboration/realtime', require('./routes/collaboration/realtime'));
app.use('/api/collaboration/permissions', require('./routes/collaboration/permissions'));
app.use('/api/push', require('./routes/push'));
app.use('/api/templates/analytics', require('./routes/templates/analytics'));
app.use('/api/sso', require('./routes/sso'));
app.use('/api/admin/dashboard', require('./routes/admin/dashboard'));
app.use('/api/white-label', require('./routes/white-label'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/sso/scim', require('./routes/sso/scim'));
app.use('/api/admin/audit', require('./routes/admin/audit'));
app.use('/api/admin/settings', require('./routes/admin/settings'));
app.use('/api/admin/bulk', require('./routes/admin/bulk'));
app.use('/api/admin/error-analytics', require('./routes/admin/error-analytics'));
app.use('/api/reports/schedule', require('./routes/reports/schedule'));
app.use('/api/white-label/theme', require('./routes/white-label/theme'));
app.use('/api/cdn', require('./routes/cdn'));
app.use('/api/cdn/analytics', require('./routes/cdn/analytics'));
app.use('/api/cdn/warming', require('./routes/cdn/warming'));
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/monitoring/tracing', require('./routes/monitoring/tracing'));
app.use('/api/disaster-recovery', require('./routes/disaster-recovery'));
app.use('/api/disaster-recovery/encryption', require('./routes/disaster-recovery/encryption'));
app.use('/api/microservices', require('./routes/microservices'));
app.use('/api/database', require('./routes/database/sharding'));
app.use('/api/database/rebalancing', require('./routes/database/rebalancing'));
// AI input-size cap (M1): reject oversized free-text BEFORE it reaches a model, so a
// single huge transcript/content/prompt can't burn a user's AI budget. Applies to
// every AI surface; tighter than the 10mb body limit (token-level).
app.use(['/api/ai', '/api/creative'], require('./middleware/aiInputCap'));
// Sentry AI Agent Monitoring: group multi-step AI calls by conversation/session/user.
const sentryConversation = require('./middleware/sentryConversation');
app.use('/api/ai', sentryConversation);
app.use('/api/creative/ideation', sentryConversation);
app.use('/api/content-operations', sentryConversation);
app.use('/api/pipeline', sentryConversation);
app.use('/api/creative/ideation', require('./routes/creative/ideation'));
app.use('/api/creative/brand-voice', require('./routes/creative/brand-voice'));
app.use('/api/creative/hashtags', require('./routes/creative/hashtags'));
app.use('/api/productive/calendar', require('./routes/productive/calendar'));
app.use('/api/productive/repurposing', require('./routes/productive/repurposing'));
app.use('/api/productive/ab-testing', require('./routes/productive/ab-testing'));
app.use('/api/video/ai-editing', require('./routes/video/ai-editing'));
app.use('/api/video/viral', require('./routes/video/viral'));
app.use('/api/video/manual-editing', require('./routes/video/manual-editing'));
app.use('/api/video/creative', require('./routes/video/creative'));
// Hook analysis + sentence-timed auto-captions. The router existed but was never
// mounted, so POST /api/video/hook-analysis/auto-caption (used by the editor's
// "Add captions" button, the one-click AutomateView, and Auto Viral Edit) 404'd.
app.use('/api/video/hook-analysis', require('./routes/video/hook-analysis'));
app.use('/api/agentic', require('./routes/agentic'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/video/voice-hooks', require('./routes/video/voice-hooks'));
app.use('/api/video/captions', require('./routes/video/captions'));
app.use('/api/video/advanced-editing', require('./routes/video/advanced-editing'));
// Clip hub: list, rate, delete, publish-and-learn. Restored from
// backup-before-revert-2026-05-10 because the page at
// /dashboard/clips/hub depends on these endpoints.
app.use('/api/video/clips', require('./routes/video/clips'));
// Remotion-based render pipeline. Routes inside the file are /render,
// /render-multi, /render/:jobId/status, /render/:jobId/download. Mounted
// here under /api/video so the manual editor's POST /api/video/render
// reaches it. Was previously orphaned (file existed but no mount), which
// is why the frontend's render button silently 404'd.
app.use('/api/video', require('./routes/video/render'));
// Multi-Format Repurpose Studio: POST /api/video/repurpose → one source video
// to N platform-native, smart-reframed variants. Renders via the render
// pipeline above, so its /render/:jobId/status + /download endpoints serve the
// resulting variant jobIds. Mounted under /api/video alongside render.
app.use('/api/video', require('./routes/video/repurpose'));
// Repurpose Recipes: save/browse/remix shareable repurpose "formulas".
// Mounted at the more specific path so it takes precedence over /repurpose.
app.use('/api/video/repurpose/recipes', require('./routes/video/repurposeRecipes'));
// Tools hub: silence-removal, filler removal, edit-by-text. Thin wrappers
// around aiVideoEditingService.js so the Tools UI can hit single endpoints.
app.use('/api/video/tools', require('./routes/video/tools'));
app.use('/api/graphql', require('./routes/graphql'));
app.use('/api/plugins', require('./routes/plugins'));
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/workflows/advanced-automation', require('./routes/workflows/advanced-automation'));
app.use('/api/video/analytics', require('./routes/video/analytics'));
app.use('/api/video/transcription', require('./routes/video/transcription'));
app.use('/api/video/thumbnails', require('./routes/video/thumbnails'));
app.use('/api/video/chapters', require('./routes/video/chapters'));
app.use('/api/video/optimization', require('./routes/video/optimization'));
app.use('/api/video/neural', require('./routes/video/neural'));
// Debug log relay is a dev/staging tool that exposes recent server logs with no
// auth — never expose it on the public production URL.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', require('./routes/debug'));
}
app.use('/api/ai/multi-model', require('./routes/ai/multi-model'));
app.use('/api/ai/recommendations', require('./routes/ai/recommendations'));
app.use('/api/ai/predictive', require('./routes/ai/predictive'));
app.use('/api/ai/advanced', require('./routes/ai/advanced'));
app.use('/api/ai/content-generation', require('./routes/ai/content-generation'));
app.use('/api/ai/adapt', require('./routes/ai/adapt'));
// Universal AI feedback (every surface) — closes the learn-from-feedback loop.
// Specific path, mounted before the general /api/ai routers.
app.use('/api/ai/feedback', require('./routes/ai/feedback'));
// Unified asset generation (voiceover / SFX / image) for the editor's Generate
// panel. Specific path so it takes precedence over the general /api/ai routers.
app.use('/api/ai/generate', require('./routes/ai/generate'));
app.use('/api/ai', require('./routes/ai/generate-idea'));
app.use('/api/infrastructure/cache', require('./routes/infrastructure/cache'));
app.use('/api/infrastructure/load-balancer', require('./routes/infrastructure/load-balancer'));
app.use('/api/infrastructure/database', require('./routes/infrastructure/database'));
app.use('/api/infrastructure/resources', require('./routes/infrastructure/resources'));
// Advanced workflows mounting
// app.use('/api/workflows/advanced', require('./routes/workflows/advanced'));
app.use('/api/workflows/templates', require('./routes/workflows/templates'));

// Mobile app routes (if needed for mobile-specific endpoints)
// app.use('/api/mobile', require('./routes/mobile'));
app.use('/api/search/advanced', require('./routes/search/advanced'));
app.use('/api/search/elasticsearch', require('./routes/search/elasticsearch'));
app.use('/api/suggestions/enhanced', require('./routes/suggestions/enhanced'));
app.use('/api/workflows/enhanced', require('./routes/workflows/enhanced'));
app.use('/api/ai', require('./routes/ai-recommendations'));
app.use('/api/scheduling', require('./routes/scheduling/advanced'));
app.use('/api/scheduling/advanced', require('./routes/scheduling/advanced'));
app.use('/api/pipeline', require('./routes/pipeline'));

// AI Content Operations routes
app.use('/api/content-operations', require('./routes/content-operations'));

// Enterprise routes
app.use('/api/enterprise', require('./routes/enterprise'));

// Agency routes
app.use('/api/agency', require('./routes/agency'));

// Advanced recycling routes
app.use('/api/recycling-advanced', require('./routes/recycling-advanced'));
app.use('/api/recycling', require('./routes/recycling'));

// Content Ops API routes
app.use('/api/content-ops', require('./routes/content-ops-api'));

// Webhook routes

// Integration routes
app.use('/api/integrations', require('./routes/integrations'));

// Event streaming routes
app.use('/api/events', require('./routes/events'));

// Billing routes
app.use('/api/billing', require('./routes/billing'));

// Usage analytics routes
app.use('/api/usage-analytics', require('./routes/usage-analytics'));

// Agency calendar routes
app.use('/api/agency', require('./routes/agency-calendar'));

// Agency campaign routes
app.use('/api/agency', require('./routes/agency-campaigns'));

// Agency bulk operations routes
app.use('/api/agency', require('./routes/agency-bulk'));

// Enhanced calendar routes
app.use('/api/agency', require('./routes/calendar-enhanced'));

// Content Calendar Autofill — AI-draft a week/month of posts for review
app.use('/api/calendar', require('./routes/calendar-autofill'));

// Client portal routes
app.use('/api/client-portal', require('./routes/client-portal'));

// Branded links routes
app.use('/api/agency', require('./routes/branded-links'));
app.use('/l', require('./routes/link-resolver')); // Public link resolution (GET /l/:shortCode)

// Reports routes
app.use('/api/agency', require('./routes/reports'));

// Enhanced reports routes
app.use('/api/agency', require('./routes/reports-enhanced'));

// Enhanced portal routes
app.use('/api/client-portal', require('./routes/portal-enhanced'));
app.use('/api/agency', require('./routes/portal-enhanced'));

// Client guidelines routes
app.use('/api/workspaces', require('./routes/client-guidelines'));

// Multi-step approval workflow routes
app.use('/api/approvals', require('./routes/approval-workflow'));

// Email approval routes (public)
app.use('/api/email-approval', require('./routes/email-approval'));

// Post comments routes
app.use('/api/posts', require('./routes/post-comments'));

// Post versions routes
app.use('/api/posts', require('./routes/post-versions'));

// Enhanced workflow routes
app.use('/api/agency', require('./routes/workflow-enhanced'));
app.use('/api/approvals', require('./routes/workflow-enhanced'));
app.use('/api/comments', require('./routes/workflow-enhanced'));

// Cross-client features routes
app.use('/api/agency', require('./routes/cross-client-features'));
app.use('/api/clients', require('./routes/cross-client-features'));
app.use('/api/evergreen-queues', require('./routes/cross-client-features'));

// Enhanced cross-client features routes
app.use('/api/agency', require('./routes/cross-client-enhanced'));
app.use('/api/clients', require('./routes/cross-client-enhanced'));
app.use('/api/health-alerts', require('./routes/cross-client-enhanced'));

// Value tracking routes
app.use('/api/clients', require('./routes/value-tracking'));
app.use('/api/agency', require('./routes/value-tracking'));

// Service tiers routes
app.use('/api/agency', require('./routes/service-tiers'));
app.use('/api/clients', require('./routes/service-tiers'));

// KPI dashboard routes
app.use('/api/agency', require('./routes/kpi-dashboard'));

// Enhanced value tracking routes
app.use('/api/clients', require('./routes/value-tracking-enhanced'));
app.use('/api/agency', require('./routes/value-tracking-enhanced'));

// Social performance metrics routes
app.use('/api/posts', require('./routes/social-performance-metrics'));
app.use('/api/workspaces', require('./routes/social-performance-metrics'));
app.use('/api/audience-growth', require('./routes/social-performance-metrics'));

// Enhanced social performance metrics routes
app.use('/api/workspaces', require('./routes/social-performance-enhanced'));
app.use('/api/posts', require('./routes/social-performance-enhanced'));
app.use('/api/audience-growth', require('./routes/social-performance-enhanced'));

// Traffic, conversions, and revenue routes
app.use('/api/clicks', require('./routes/traffic-conversions'));
app.use('/api/posts', require('./routes/traffic-conversions'));
app.use('/api/conversions', require('./routes/traffic-conversions'));
app.use('/api/workspaces', require('./routes/traffic-conversions'));
app.use('/api/webhooks', require('./routes/traffic-conversions'));

// Enhanced revenue routes
app.use('/api/conversions', require('./routes/revenue-enhanced'));
app.use('/api/workspaces', require('./routes/revenue-enhanced'));
app.use('/api/revenue-goals', require('./routes/revenue-enhanced'));

// Content insights routes
app.use('/api/posts', require('./routes/content-insights'));
app.use('/api/workspaces', require('./routes/content-insights'));

// Enhanced content insights routes
app.use('/api/posts', require('./routes/content-insights-enhanced'));
app.use('/api/workspaces', require('./routes/content-insights-enhanced'));
app.use('/api/content', require('./routes/content-insights-enhanced'));

// Client health routes
app.use('/api/workspaces', require('./routes/client-health'));
app.use('/api/clients', require('./routes/client-health'));
app.use('/api/posts', require('./routes/client-health'));

// Enhanced client health routes
app.use('/api/clients', require('./routes/client-health-enhanced'));
app.use('/api/workspaces', require('./routes/client-health-enhanced'));
app.use('/api/competitors', require('./routes/client-health-enhanced'));
app.use('/api/comments', require('./routes/client-health-enhanced'));

// Agency business metrics routes
app.use('/api/agencies', require('./routes/agency-business'));
app.use('/api/satisfaction', require('./routes/agency-business'));

// Enhanced agency business routes
app.use('/api/agencies', require('./routes/agency-business-enhanced'));

// Approval Kanban routes
app.use('/api/clients', require('./routes/approval-kanban'));
app.use('/api/approvals', require('./routes/approval-kanban'));

// Simple client portal routes
app.use('/api/simple-portal', require('./routes/simple-portal'));

// Inline comments routes
app.use('/api/posts', require('./routes/inline-comments'));

// Version comparison routes
app.use('/api/versions', require('./routes/version-comparison'));

// Enhanced approval routes
app.use('/api/clients', require('./routes/approval-enhanced'));
app.use('/api/approvals', require('./routes/approval-enhanced'));
app.use('/api/posts', require('./routes/approval-enhanced'));
app.use('/api/workspaces', require('./routes/approval-enhanced'));
app.use('/api/simple-portal', require('./routes/approval-enhanced'));

// Report builder routes
app.use('/api/reports', require('./routes/report-builder'));
app.use('/api/agencies', require('./routes/report-builder'));

// Enhanced report routes
app.use('/api/reports', require('./routes/report-enhanced'));

// Enhanced pricing routes
app.use('/api/pricing', require('./routes/pricing-enhanced'));

// Export routes

// Enhanced support routes
app.use('/api/support', require('./routes/support-enhanced'));

// Pro mode routes
app.use('/api/pro-mode', require('./routes/pro-mode'));
// Per-creator personalization: the learning write-loop (record choices) + the
// AI voice/brand/defaults controls. Powers personalizationService across every
// AI surface (repurpose copy, generation, the autonomous pipeline).
app.use('/api/me', require('./routes/me-personalization'));

// Status page (public)

// Workload dashboard routes
app.use('/api/workload', require('./routes/workload-dashboard'));

// Playbook routes
app.use('/api/playbooks', require('./routes/playbooks'));

// Risk flag routes
app.use('/api/risk-flags', require('./routes/risk-flags'));

// AI content routes
app.use('/api/ai', require('./routes/ai'));
app.use('/api/moderation', require('./routes/moderation'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/video/advanced', require('./routes/video/advanced'));
app.use('/api/video/progress', require('./routes/video/progress'));
app.use('/api/workflows/webhooks', require('./routes/workflows/webhooks'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/jobs/dashboard', require('./routes/jobs/dashboard'));
app.use('/api/jobs', require('./routes/jobs/progress'));
app.use('/api/upload/chunked', require('./routes/upload/chunked'));
app.use('/api/security', require('./routes/security'));
app.use('/api/privacy', require('./routes/privacy'));
app.use('/api/cache', require('./routes/cache'));
app.use('/api/oauth/twitter', require('./routes/oauth/twitter'));
app.use('/api/oauth/linkedin', require('./routes/oauth/linkedin'));
app.use('/api/oauth/google', require('./routes/oauth/google'));
app.use('/api/oauth/facebook', require('./routes/oauth/facebook'));
app.use('/api/oauth/instagram', require('./routes/oauth/instagram'));
app.use('/api/oauth/youtube', require('./routes/oauth/youtube'));
app.use('/api/oauth/tiktok', require('./routes/oauth/tiktok'));
app.use('/api/oauth/health', require('./routes/oauth/health'));
app.use('/api/oauth', require('./routes/oauth'));
// Live trends — /now returns trending sounds + hashtags + topics for a
// platform. Wired here so the editor's "TRENDS" Quick Action and any
// niche dashboards can read fresh feeds without hammering external APIs.
app.use('/api/trends', require('./routes/trends'));
app.use('/api/seo', require('./routes/seo'));
// Google integrations — YouTube Data + Analytics + Search Console reads.
// All routes return `{ connected: false }` when Google isn't linked, so
// the client can render a "Connect Google" CTA without an error toast.
app.use('/api/integrations', require('./routes/integrations/google'));
app.use('/api/monitoring/performance', require('./routes/monitoring/performance'));
app.use('/api/monitoring/cache', require('./routes/monitoring/cache'));
app.use('/api/monitoring/database', require('./routes/monitoring/database'));
app.use('/api/analytics/user', require('./routes/analytics/user'));
app.use('/api/transcripts', require('./routes/transcripts'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/translation', require('./routes/translation'));
app.use('/api/feature-flags', require('./routes/feature-flags'));
app.use('/api/sovereign', require('./routes/sovereign'));
app.use('/api/captions-spatial', require('./routes/spatial'));
app.use('/api/phase8/spatial', require('./routes/spatial'));
app.use('/api/phase8', require('./routes/phase8'));
// Phase 9-18 routers. phase10_12 / phase13_15 / phase16_18 each cover several
// phases via flat internal paths (e.g. /fleet, /arbitrage, /s2s), so they are
// mounted at each phase prefix they serve so the frontend's /phaseN/* calls resolve.
app.use('/api/phase9', require('./routes/phase9'));
const phase10_12 = require('./routes/phase10_12');
app.use('/api/phase10', phase10_12);
app.use('/api/phase11', phase10_12);
app.use('/api/phase12', phase10_12);
const phase13_15 = require('./routes/phase13_15');
app.use('/api/phase13', phase13_15);
app.use('/api/phase14', phase13_15);
app.use('/api/phase15', phase13_15);
const phase16_18 = require('./routes/phase16_18');
app.use('/api/phase16', phase16_18);
app.use('/api/phase17', phase16_18);
app.use('/api/phase18', phase16_18);
app.use('/api/monetization', require('./routes/monetization'));
app.use('/api/click', require('./routes/click'));
app.use('/api/vector-memory', require('./routes/vector-memory'));

app.get('/api/dev/db-cleanup', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const adminDb = mongoose.connection.db.admin();
    const dbs = await adminDb.listDatabases();
    let droppedMsg = [];
    for (const dbInfo of dbs.databases) {
      if (dbInfo.name !== 'click_v3' && dbInfo.name !== 'admin' && dbInfo.name !== 'local') {
        const tempDb = mongoose.connection.client.db(dbInfo.name);
        await tempDb.dropDatabase();
        droppedMsg.push(`Dropped DB: ${dbInfo.name}`);
      }
    }
    
    // Also drop some specific junk collections in click_v3 if any
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    let droppedCols = 0;
    const junkCols = collections.filter(c => c.name.includes('test') || c.name.includes('old') || c.name.includes('bak'));
    for (const coll of junkCols.slice(0, 10)) {
      await db.collection(coll.name).drop();
      droppedCols++;
    }

    res.json({ success: true, message: `Dropped ${droppedCols} junk collections. ${droppedMsg.join(', ')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check (no rate limiting)
app.use('/api/health', require('./routes/health'));
app.use('/api/free-ai-models', require('./routes/free-ai-models'));
app.use('/api/model-versions', require('./routes/model-versions'));

// Monitoring and Health Check Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// Legacy health-pro route for backward compatibility and Quality Gate tests
app.get('/api/status/health-pro', (req, res) => {
  res.json({ status: 'up' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

app.get('/api/monitoring/health', (req, res) => {
  const { getDatabaseHealth } = require('./config/database');
  const dbHealth = getDatabaseHealth();

  const health = {
    server: {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    },
    database: dbHealth,
    apm: global.apmMonitor ? global.apmMonitor.healthCheck() : { status: 'not_initialized' },
    alerting: global.alertingSystem ? global.alertingSystem.getStats() : { status: 'not_initialized' },
    timestamp: new Date().toISOString()
  }

  res.json(health)
})

app.get('/api/monitoring/metrics', (req, res) => {
  const metrics = {
    apm: global.apmMonitor ? global.apmMonitor.getStats() : null,
    alerting: global.alertingSystem ? global.alertingSystem.getStats() : null,
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    },
    timestamp: new Date().toISOString()
  }

  res.json(metrics)
})

app.get('/api/monitoring/alerts', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50
  const alerts = global.alertingSystem ? global.alertingSystem.getHistory(limit) : []
  res.json({ alerts, timestamp: new Date().toISOString() })
})

app.post('/api/monitoring/test-alert', async (req, res) => {
  if (global.alertingSystem) {
    await global.alertingSystem.test()
    res.json({ message: 'Test alert sent' })
  } else {
    res.status(503).json({ error: 'Alerting system not initialized' })
  }
})

// Frontend catch-all: hand any non-API route to the Next.js app (production,
// single-URL deployment). Registered after all /api routes and before the 404
// handler so the API always wins. If the Next handler isn't available it falls
// through to the normal 404 — never blocks the API.
app.use(async (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/socket.io') ||
    req.path.startsWith('/uploads')
  ) return next();
  try { await __nextReady; } catch { /* fall through */ }
  if (__nextHandler) return __nextHandler(req, res);
  return next();
});

// 404 handler
app.use(notFound);

// Sentry error handler - catches errors not handled by custom middleware (only if Sentry is initialized)
if (Sentry && typeof Sentry.expressErrorHandler === 'function') {
  app.use(Sentry.expressErrorHandler());
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Always bind to port, even if some services failed to initialize
let server;
// Graceful shutdown hooks (helps nodemon restarts release port cleanly in dev)
let __shutdownHooksInstalled = false;
function __installShutdownHooks() {
  if (__shutdownHooksInstalled) return;
  __shutdownHooksInstalled = true;

  const shutdown = (signal, isNodemonRestart = false) => {
    // #region agent log
    try {
      // Shutdown signal received
    } catch (err) { /* ignore */ }
    // #endregion

    const finish = () => {
      // #region agent log
      try {
        // Cleanup logic
      } catch (err) {
        logger.warn('Cleanup hook error', { error: err.message });
      }
      // #endregion

      // Stop background crons so their node-cron timers don't survive a nodemon
      // restart or keep the process alive. Best-effort — never block shutdown.
      try { require('./services/performanceLearningCron').stopLearningCron?.(); } catch (err) { /* ignore */ }
      try { require('./services/performanceAlertService').stopAlertCron?.(); } catch (err) { /* ignore */ }
      try { require('./services/alertSweepCronService').stopAlertSweepCron?.(); } catch (err) { /* ignore */ }

      // Flush Sentry events before shutdown
      if (Sentry && typeof Sentry.close === 'function') {
        try {
          Sentry.close(2000).catch(() => { });
        } catch (err) {
          // Ignore Sentry close errors
        }
      }

      // Close mongoose connection if it exists
      try {
        if (mongoose?.connection?.readyState) {
          mongoose.connection.close(false).catch(() => { });
        }
      } catch (err) {
        // Mongoose close error ignored
      }

      // Stop the APM monitor's CPU/memory/GC intervals so they don't keep the
      // process alive or leak across restarts.
      try { global.apmMonitor?.stop?.(); } catch (err) { /* ignore */ }

      if (isNodemonRestart) {
        // Hand control back to nodemon
        try { process.kill(process.pid, 'SIGUSR2'); } catch { process.exit(0); }
      } else {
        process.exit(0);
      }
    };

    try {
      if (server && server.listening) {
        // #region agent log
        try {
          // Closing server logic
        } catch (err) {
          logger.warn('Server close error', { error: err.message });
        }
        // #endregion

        // Graceful drain: stop accepting NEW connections (server.close), let
        // in-flight requests finish, and close only IDLE keep-alive sockets now.
        // After a grace window, force-close any stragglers so the deploy can't
        // hang. Previously closeAllConnections() ran FIRST, aborting in-flight
        // renders/webhooks/writes. Nodemon restarts (dev) skip the wait.
        global.__shuttingDown = true; // readiness probe now sheds traffic (503)
        server.close(() => finish());
        try { server.closeIdleConnections && server.closeIdleConnections(); } catch (err) { /* ignore */ }
        const graceMs = isNodemonRestart ? 0 : parseInt(process.env.SHUTDOWN_DRAIN_MS || '15000', 10);
        const forceTimer = setTimeout(() => {
          try { server.closeAllConnections && server.closeAllConnections(); } catch (err) { /* ignore */ }
        }, graceMs);
        if (typeof forceTimer.unref === 'function') forceTimer.unref();
        return;
      }
    } catch { /* intentionally empty */ }
    finish();
  };

  process.once('SIGINT', () => shutdown('SIGINT', false));
  process.once('SIGTERM', () => shutdown('SIGTERM', false));
  // Nodemon restart signal
  process.once('SIGUSR2', () => shutdown('SIGUSR2', true));

  // #region agent log
  process.once('exit', (code) => {
    try {
      // Final exit with code: code
    } catch (err) { /* ignore */ }
  });
  // #endregion
}

// Skip the boot block (shutdown hooks, listen, crons, redis init) when this
// file is required under jest — tests want the express app, not a running
// process. Gate ONLY on JEST_WORKER_ID (which jest itself sets per worker)
// — NOT on NODE_ENV=test, because the e2e workflow's `npm start &` step
// also sets NODE_ENV=test and DOES need the listen to fire.
if (process.env.JEST_WORKER_ID) {
  // exported `app` above is enough for supertest
} else {
  __installShutdownHooks();
  
  const startMainServer = () => {
    try {
      server = app.listen(PORT, HOST, () => {
        logger.info(`🚀 Server running on port ${PORT}`);
        logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);

        // Initialize Socket.io for real-time updates
        if (!process.env.JEST_WORKER_ID) {
          initializeSocket(server);
          logger.info('🔌 Socket.io initialized for real-time updates');
        }

        // C2PA provenance signer check (non-fatal — renders go unsigned if absent)
        if (process.env.NODE_ENV !== 'test') {
          require('./services/c2paService').verifyC2paTools()
            .then((c2pa) => {
              if (c2pa.available) {
                logger.info(`🔏 C2PA provenance signer ready: ${c2pa.signer} ${c2pa.version || ''}`.trim());
              } else {
                logger.warn('🔏 C2PA signer unavailable — renders will be unsigned', { reason: c2pa.error });
              }
            })
            .catch((err) => logger.warn('C2PA verification check failed', { error: err.message }));
        }

        // Schedule background tasks
        if (process.env.NODE_ENV !== 'test') {
          // File cleanup (daily at 2 AM)
          cron.schedule('0 2 * * *', async () => {
            logger.info('🧹 Running scheduled file cleanup...');
            const uploadsDir = path.join(__dirname, '../uploads');
            await cleanupOldFiles(path.join(uploadsDir, 'videos'), 30);
            await cleanupOldFiles(path.join(uploadsDir, 'clips'), 14);
            await cleanupOldFiles(path.join(uploadsDir, 'thumbnails'), 14);
            await cleanupOldFiles(path.join(uploadsDir, 'quotes'), 30);
            logger.info('✅ File cleanup completed');
          });

          // Temp-file sweep (every 6 hours). Safety net for ffmpeg/processing
          // leftovers that should be cleaned at process completion but may be
          // orphaned on crash/error — prevents unbounded temp-disk growth.
          cron.schedule('0 */6 * * *', async () => {
            try {
              const root = path.join(__dirname, '..');
              let removed = 0;
              // Skip the tus resumable-upload store — it manages its own
              // per-upload expiration below. A blind mtime sweep here would
              // delete in-progress/paused uploads and defeat resume.
              removed += await cleanupTempFiles(path.join(root, 'uploads', 'temp'), 6, { exclude: ['tus'] });
              removed += await cleanupTempFiles(path.join(root, 'tmp'), 6);
              removed += await cleanupTempFiles(path.join(root, 'tmp', 'uploads'), 6);
              // Abandoned resumable (tus) uploads — removed by per-upload age,
              // so active/recent uploads inside the resume window are preserved.
              try {
                const { cleanupExpiredTusUploads } = require('./routes/upload-tus');
                removed += await cleanupExpiredTusUploads();
              } catch (tusErr) {
                logger.warn('tus expiry sweep skipped', { error: tusErr.message });
              }
              // Stale ffmpeg logs (CLAUDE.md routes them to logs/) older than 7 days.
              await cleanupOldFiles(path.join(root, 'logs'), 7);
              if (removed > 0) logger.info(`🧹 Temp sweep removed ${removed} orphaned entries`);
            } catch (err) {
              logger.error('❌ Temp sweep error', { error: err.message });
            }
          });

          // Subscription checks (daily at 3 AM)
          cron.schedule('0 3 * * *', async () => {
            logger.info('🔔 Checking subscription expirations...');
            try {
              const { processExpiredSubscriptions, sendExpirationWarnings } = require('./services/subscriptionService');
              await processExpiredSubscriptions();
              await sendExpirationWarnings([7, 3, 1]);
              logger.info('✅ Subscription expiration check completed');
            } catch (err) {
              logger.error('❌ Subscription check error', { error: err.message });
            }
          });

          // Expiration warnings (every 6 hours)
          cron.schedule('0 */6 * * *', async () => {
            try {
              const { sendExpirationWarnings } = require('./services/subscriptionService');
              await sendExpirationWarnings([7, 3, 1]);
            } catch (err) {
              logger.error('❌ Expiration warning error', { error: err.message });
            }
          });

          // Token refresh (every 6 hours — matches tokenRefreshWorker schedule)
          cron.schedule('0 */6 * * *', async () => {
            logger.info('🔄 Refreshing social media tokens...');
            try {
              const { refreshExpiringTokens } = require('./services/tokenRefreshService');
              const result = await refreshExpiringTokens();
              logger.info(`✅ Token refresh completed: ${result.successCount} refreshed, ${result.failCount} failed`);
            } catch (error) {
              logger.error('❌ Token refresh error', { error: error.message });
            }
          });

          // Health reports (daily at 4 AM)
          cron.schedule('0 4 * * *', async () => {
            logger.info('📊 Generating daily health reports...');
            try {
              const { generateHealthReports } = require('./services/healthReportService');
              await generateHealthReports();
              logger.info('✅ Daily health reports generated');
            } catch (err) {
              logger.error('❌ Failed to generate health reports', { error: err.message });
            }
          });

          // Scheduled white-label client reports (hourly). Generates due
          // ScheduledReport rows from their template + delivers branded
          // email/portal/webhook, then advances each row's nextGeneration. The
          // per-row query gate (isActive + nextGeneration<=now) means an empty
          // queue is a no-op.
          cron.schedule('0 * * * *', async () => {
            try {
              const { processScheduledReports } = require('./services/scheduledReportService');
              const { processed } = await processScheduledReports();
              if (processed > 0) logger.info('📑 Scheduled client reports processed', { processed });
            } catch (err) {
              logger.error('❌ Failed to process scheduled reports', { error: err.message });
            }
          });

          // Channel video sync (daily at 5 AM) — refresh the SocialVideo store
          // for connected YouTube channels so the Growth layer (outliers,
          // retention) stays current across each creator's WHOLE channel,
          // including videos published outside Click.
          cron.schedule('0 5 * * *', async () => {
            try {
              const { runScheduledSync } = require('./services/socialVideoSyncService');
              const { users, synced } = await runScheduledSync();
              if (synced > 0) logger.info('📹 Channel video sync complete', { users, synced });
            } catch (err) {
              logger.error('❌ Failed channel video sync', { error: err.message });
            }
          });

          // Autonomous content agent — hands-off trigger. OPT-IN via
          // AGENT_AUTORUN=true (default OFF) so it never mass-runs by surprise;
          // even when on, each run's PUBLISH stage is still gated by
          // AGENT_AUTOPUBLISH + a connected account. Processes a small batch of
          // recently-completed, not-yet-agented Content every 30 minutes.
          if (process.env.AGENT_AUTORUN === 'true') {
            cron.schedule('*/30 * * * *', async () => {
              try {
                const Content = require('./models/Content');
                const AgenticJob = require('./models/AgenticJob');
                const { startAgentPipeline } = require('./services/agenticWorkflowService');
                const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // last 2h
                const candidates = await Content.find({ status: 'completed', createdAt: { $gte: since } })
                  .select('_id userId').sort({ createdAt: -1 }).limit(5).lean().catch(() => []);
                let started = 0;
                for (const c of candidates) {
                  const already = await AgenticJob.findOne({ videoId: String(c._id) }).select('_id').lean().catch(() => null);
                  if (already) continue;
                  await startAgentPipeline(String(c._id), [], String(c.userId));
                  started++;
                }
                if (started > 0) logger.info(`🤖 Autonomous agent started ${started} pipeline run(s)`);
              } catch (err) {
                logger.error('❌ Autonomous agent cron failed', { error: err.message });
              }
            });
            logger.info('🤖 Autonomous content agent cron enabled (AGENT_AUTORUN=true)');
          }
        }
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`❌ Port ${PORT} is already in use.`);
          process.exit(1);
        } else {
          logger.error('Server error:', err);
        }
      });
    } catch (listenError) {
      logger.error('❌ CRITICAL: Failed to start server:', { error: listenError.message });
      process.exit(1);
    }
  };

  if (healthCheckServer) {
    logger.info('Closing health check server to start main server...');
    if (typeof healthCheckServer.closeAllConnections === 'function') {
      healthCheckServer.closeAllConnections();
    }
    const closeServer = () => {
      healthCheckServer.close(() => {
        logger.info('Health check server closed');
        setTimeout(startMainServer, 100);
      });
    };
    if (healthCheckServer.listening) {
      closeServer();
    } else {
      healthCheckServer.once('listening', closeServer);
      healthCheckServer.once('error', () => {
        startMainServer();
      });
    }
  } else {
    startMainServer();
  }
}


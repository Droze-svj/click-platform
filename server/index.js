// Log that we're starting
console.log('🚀 Starting server...');
console.log('📝 Node version:', process.version);
console.log('📝 Working directory:', process.cwd());
console.log('📝 PORT environment variable:', process.env.PORT || 'NOT SET (will use 5001)');
console.log('📝 NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

// Global error handlers - must be first to catch all errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  Sentry.captureException(error, {
    tags: { type: 'uncaught_exception' },
    level: 'fatal'
  });
  // Don't exit immediately - try to start server for health checks
  console.error('⚠️ Attempting to start server despite error...');
});

process.on('unhandledRejection', (reason, promise) => {
  // Filter out Redis localhost connection errors - these are expected when REDIS_URL is not set
  if (reason && typeof reason === 'object' && reason.message &&
      reason.message.includes('ECONNREFUSED') && reason.message.includes('127.0.0.1:6379')) {
    // These are expected when REDIS_URL is not configured - workers will be closed automatically
    // Don't spam logs with these errors
    return;
  }

  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  Sentry.captureException(reason, {
    tags: { type: 'unhandled_rejection' },
    extra: { promise: promise.toString() }
  });
  // Don't exit - try to start server anyway
  console.error('⚠️ Attempting to start server despite error...');
});

console.log('📦 Loading environment variables...');
require('dotenv').config();
console.log('✅ Environment variables loaded');

// Initialize Sentry for error tracking
const Sentry = require('@sentry/node');
Sentry.init({
  dsn: "https://a400da46f531219b7ce6f78a9d5cb6ff@o4510623214731264.ingest.de.sentry.io/4510629716033616",
  sendDefaultPii: true,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
});

// Start minimal health check server (production/staging only).
// In local dev, this extra server can race with nodemon restarts and cause EADDRINUSE / partial startup.
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';
const __isHosted = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

let healthCheckServer = null;
if (__isHosted) {
  console.log(`📝 Starting health check server on port ${PORT}...`);
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
      console.log(`✅ Health check server bound to port ${PORT} on ${HOST}`);
      console.log(`✅ Port ${PORT} is now open - Render.com can detect it`);
      console.log(`✅ Health check available at http://${HOST}:${PORT}/api/health`);
    });
    
    healthCheckServer.on('error', (err) => {
      console.error('❌ Health check server error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error('⚠️ Port is already in use. This might be from a previous deployment.');
      }
      // Don't exit - let the process continue
    });
    
    // Keep server alive
    healthCheckServer.keepAliveTimeout = 65000;
    healthCheckServer.headersTimeout = 66000;
    
  } catch (healthError) {
    console.error('❌ CRITICAL: Failed to start health check server:', healthError);
    console.error('Stack:', healthError.stack);
    // This is critical in hosted environments, but don't exit - let the main server try to start
  }
} else {
  console.log('📝 Dev mode: skipping separate health check server (starting Express directly)');
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const { securityHeaders, customSecurityHeaders } = require('./middleware/securityHeaders');
const cron = require('node-cron');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const validateEnv = require('./middleware/validateEnv');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { enhancedErrorHandler, notFoundHandler, initErrorHandlers } = require('./middleware/enhancedErrorHandler');
const { apiLimiter } = require('./middleware/enhancedRateLimiter');
const requestLogger = require('./middleware/requestLogger');
const { requestTimeout, getTimeoutForRoute } = require('./middleware/requestTimeout');
const { cleanupOldFiles } = require('./utils/fileCleanup');
const logger = require('./utils/logger');
const { initializeSocket } = require('./services/socketService');
const { trackResponseTime } = require('./utils/performance');

// Initialize Sentry before anything else
const { initSentry } = require('./utils/sentry');
initSentry();

// Initialize Email Service
const { initEmailService } = require('./services/emailService');
initEmailService();

// Initialize Cache Service
const { initCache } = require('./services/cacheService');
initCache().catch(err => {
  logger.warn('Cache initialization failed', { error: err.message });
});

// Initialize Intelligent Cache Service
const { initIntelligentCache } = require('./services/intelligentCacheService');
initIntelligentCache();
logger.info('✅ Intelligent cache service initialized');

// Initialize Redis Cache Service
const redisCache = require('./utils/redisCache');
logger.info('✅ Redis cache service initialized');

// Initialize APM (Application Performance Monitoring)
const { apmMonitor, apmMiddleware } = require('./utils/apm');
global.apmMonitor = apmMonitor; // Make available globally for error handlers
logger.info('✅ APM monitoring service initialized');

// Initialize Alerting System
const alertingSystem = require('./utils/alerting');
global.alertingSystem = alertingSystem;
logger.info('✅ Alerting system initialized');

// Initialize API Optimization Middleware
const apiOptimizer = require('./middleware/apiOptimizer');
logger.info('✅ API optimization middleware loaded');

// Initialize Database Optimizer
const databaseOptimizer = require('./utils/databaseOptimizer');
logger.info('✅ Database optimizer loaded');

// Initialize Job Queue Workers (optional - non-blocking)
// Check Redis configuration first
const redisUrl = process.env.REDIS_URL?.trim();
const redisHost = process.env.REDIS_HOST?.trim();

logger.info('🔍 Checking Redis for job queues...', {
  hasRedisUrl: !!redisUrl,
  redisUrlLength: redisUrl?.length || 0,
  redisUrlPrefix: redisUrl ? redisUrl.substring(0, 30) + '...' : 'none',
  redisUrlFirstChars: redisUrl ? redisUrl.substring(0, 10) : 'none',
  hasRedisHost: !!redisHost,
  nodeEnv: process.env.NODE_ENV,
  rawRedisUrlExists: !!process.env.REDIS_URL,
  rawRedisUrlLength: process.env.REDIS_URL?.length || 0
});

if (process.env.NODE_ENV !== 'test') {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
  
  // Only initialize workers if Redis is properly configured
  // In production/staging, require REDIS_URL (not REDIS_HOST fallback)
  let shouldInitializeWorkers = false;
  
  if (isProduction) {
    // Production: REDIS_URL is REQUIRED and must be valid
    if (!redisUrl || redisUrl === '') {
      logger.error('❌ REDIS_URL is REQUIRED in production but is missing or empty.');
      logger.error('❌ REDIS_URL value received:', redisUrl ? `"${redisUrl.substring(0, 30)}..." (length: ${redisUrl.length})` : 'NOT SET OR EMPTY');
      logger.error('❌ Workers will NOT be initialized. Add REDIS_URL to Render.com.');
      shouldInitializeWorkers = false;
    } else if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.error('❌ Invalid REDIS_URL format in production. Must start with redis:// or rediss://');
      logger.error('❌ REDIS_URL received:', redisUrl.substring(0, 50));
      logger.error('❌ Workers will NOT be initialized until REDIS_URL is fixed.');
      shouldInitializeWorkers = false;
    } else if (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost')) {
      logger.error('❌ REDIS_URL contains localhost/127.0.0.1 in production. This is not allowed.');
      logger.error('❌ Workers will NOT be initialized. Use a cloud Redis service.');
      shouldInitializeWorkers = false;
    } else {
      logger.info('✅ REDIS_URL validated for production. Proceeding with worker initialization...');
      shouldInitializeWorkers = true;
    }
  } else {
    // Development: Allow REDIS_URL or REDIS_HOST
    shouldInitializeWorkers = (redisUrl && redisUrl !== '') || (redisHost && redisHost !== '');
  }
  
  if (shouldInitializeWorkers) {
    // CRITICAL: Double-check REDIS_URL one more time before initializing workers
    // This prevents any possibility of workers being created with invalid Redis config
    const finalRedisUrlCheck = process.env.REDIS_URL?.trim();
    if (isProduction) {
      console.log('🔍 [server/index.js] Final REDIS_URL check before worker initialization...');
      console.log(`🔍 [server/index.js] REDIS_URL exists: ${!!finalRedisUrlCheck}`);
      console.log(`🔍 [server/index.js] REDIS_URL length: ${finalRedisUrlCheck?.length || 0}`);
      console.log(`🔍 [server/index.js] REDIS_URL first 30 chars: ${finalRedisUrlCheck ? finalRedisUrlCheck.substring(0, 30) : 'NONE'}`);
      
      if (!finalRedisUrlCheck || finalRedisUrlCheck === '') {
        const errorMsg = '❌ FATAL: REDIS_URL is missing or empty right before worker initialization. Aborting.';
        console.error(errorMsg);
        logger.error(errorMsg);
        logger.error('❌ Workers will NOT be initialized. Add REDIS_URL to Render.com.');
        shouldInitializeWorkers = false;
      } else if (!finalRedisUrlCheck.startsWith('redis://') && !finalRedisUrlCheck.startsWith('rediss://')) {
        const errorMsg = '❌ FATAL: REDIS_URL format is invalid right before worker initialization. Aborting.';
        console.error(errorMsg);
        console.error(`❌ REDIS_URL: ${finalRedisUrlCheck.substring(0, 50)}`);
        logger.error(errorMsg);
        logger.error('❌ REDIS_URL received:', finalRedisUrlCheck.substring(0, 50));
        logger.error('❌ Workers will NOT be initialized until REDIS_URL is fixed.');
        shouldInitializeWorkers = false;
      } else if (finalRedisUrlCheck.includes('127.0.0.1') || finalRedisUrlCheck.includes('localhost')) {
        const errorMsg = '❌ FATAL: REDIS_URL contains localhost right before worker initialization. Aborting.';
        console.error(errorMsg);
        logger.error(errorMsg);
        logger.error('❌ Workers will NOT be initialized. Use a cloud Redis service.');
        shouldInitializeWorkers = false;
      } else {
        console.log('✅ Final REDIS_URL validation passed. Proceeding with worker initialization...');
      }
    }
    
    if (shouldInitializeWorkers) {
      try {
        const { initializeWorkers } = require('./queues');
        const { initializeScheduler } = require('./services/jobScheduler');
        initializeWorkers();
        initializeScheduler();
        logger.info('✅ Job queue system initialized');
      } catch (error) {
        // Workers are optional - server can run without them
        logger.warn('Job queue workers initialization failed', { error: error.message });
        logger.warn('Background jobs will not be processed. Server will continue without workers.');
      }
    } else {
      logger.warn('⚠️ Redis validation failed. Skipping job queue workers initialization.');
    }
  } else {
    logger.warn('⚠️ Redis not configured. Skipping job queue workers initialization.');
    if (isProduction) {
      logger.warn('⚠️ In production, REDIS_URL (starting with redis://) is required.');
    }
    logger.warn('⚠️ To enable workers, add REDIS_URL to Render.com environment variables.');
  }
}

// Initialize SLA Monitoring
const { startSLAMonitoring } = require('./services/slaCronService');
try {
  startSLAMonitoring();
  logger.info('✅ SLA monitoring initialized');
} catch (error) {
  logger.warn('SLA monitoring initialization failed', { error: error.message });
}

// Initialize Value Tracking Hooks
const { initializeValueTrackingHooks } = require('./services/valueTrackingHooks');
try {
  initializeValueTrackingHooks();
  logger.info('✅ Value tracking hooks initialized');
} catch (error) {
  logger.warn('Value tracking hooks initialization failed', { error: error.message });
}

// Initialize Value Tracking Cron Jobs
const { startMonthlyCalculationCron, startTierCheckCron } = require('./services/valueTrackingCronService');
if (process.env.NODE_ENV !== 'test') {
  try {
    startMonthlyCalculationCron();
    startTierCheckCron();
    logger.info('✅ Value tracking cron jobs initialized');
  } catch (error) {
    logger.warn('Value tracking cron jobs initialization failed', { error: error.message });
  }
}

// Initialize Model Version Upgrade Checks
const { scheduleUpgradeChecks } = require('./services/modelVersionManager');
const { scheduleRolloutIncrements } = require('./services/modelVersionGradualRollout');
if (process.env.NODE_ENV !== 'test') {
  try {
    scheduleUpgradeChecks();
    scheduleRolloutIncrements();
    logger.info('✅ Model version upgrade checks and rollout scheduler initialized');
  } catch (error) {
    logger.warn('Model version upgrade checks initialization failed', { error: error.message });
  }
}

// Initialize Audience Growth Cron
const { startAudienceGrowthCron } = require('./services/audienceGrowthCronService');
if (process.env.NODE_ENV !== 'test') {
  try {
    startAudienceGrowthCron();
    logger.info('✅ Audience growth cron initialized');
  } catch (error) {
    logger.warn('Audience growth cron initialization failed', { error: error.message });
  }
}

// Initialize Health Report Scheduler
const { scheduleHealthReports } = require('./services/healthReportSchedulerService');
if (process.env.NODE_ENV !== 'test') {
  try {
    scheduleHealthReports();
    logger.info('✅ Health report scheduler initialized');
  } catch (error) {
    logger.warn('Health report scheduler initialization failed', { error: error.message });
  }
}

// Initialize Competitor Sync Cron
const { syncAllCompetitors } = require('./services/competitorMonitoringService');
if (process.env.NODE_ENV !== 'test') {
  try {
    cron.schedule('0 4 * * *', async () => {
      try {
        await syncAllCompetitors();
        logger.info('✅ Competitor sync completed');
      } catch (error) {
        logger.warn('Competitor sync failed', { error: error.message });
      }
    });
    logger.info('✅ Competitor sync cron initialized (daily at 4 AM)');
  } catch (error) {
    logger.warn('Competitor sync cron initialization failed', { error: error.message });
  }
}

// Initialize Automated Survey Scheduler
const { scheduleAutomatedSurveys } = require('./services/automatedSurveyService');
if (process.env.NODE_ENV !== 'test') {
  try {
    scheduleAutomatedSurveys();
    logger.info('✅ Automated survey scheduler initialized');
  } catch (error) {
    logger.warn('Automated survey scheduler initialization failed', { error: error.message });
  }
}

// Initialize Business Alerts Cron (daily at 9 AM)
const { checkBusinessAlerts } = require('./services/businessAlertService');
if (process.env.NODE_ENV !== 'test') {
  try {
    cron.schedule('0 9 * * *', async () => {
      try {
        // Get all agency workspaces
        const Workspace = require('./models/Workspace');
        const agencies = await Workspace.find({ isAgency: true }).lean();
        
        for (const agency of agencies) {
          try {
            await checkBusinessAlerts(agency._id);
          } catch (error) {
            logger.warn('Error checking business alerts for agency', { agencyId: agency._id, error: error.message });
          }
        }
        
        logger.info('✅ Business alerts check completed');
      } catch (error) {
        logger.warn('Business alerts check failed', { error: error.message });
      }
    });
    logger.info('✅ Business alerts cron initialized (daily at 9 AM)');
  } catch (error) {
    logger.warn('Business alerts cron initialization failed', { error: error.message });
  }
}

// Initialize SLA Alerts Cron (every hour)
const { checkSLAAlerts } = require('./services/slaAlertService');
if (process.env.NODE_ENV !== 'test') {
  try {
    cron.schedule('0 * * * *', async () => {
      try {
        await checkSLAAlerts();
        logger.info('✅ SLA alerts check completed');
      } catch (error) {
        logger.warn('SLA alerts check failed', { error: error.message });
      }
    });
    logger.info('✅ SLA alerts cron initialized (every hour)');
  } catch (error) {
    logger.warn('SLA alerts cron initialization failed', { error: error.message });
  }
}

// Initialize Scheduled Reports Cron (every hour)
const { processScheduledReports } = require('./services/scheduledReportService');
if (process.env.NODE_ENV !== 'test') {
  try {
    cron.schedule('0 * * * *', async () => {
      try {
        await processScheduledReports();
        logger.info('✅ Scheduled reports processed');
      } catch (error) {
        logger.warn('Scheduled reports processing failed', { error: error.message });
      }
    });
    logger.info('✅ Scheduled reports cron initialized (every hour)');
  } catch (error) {
    logger.warn('Scheduled reports cron initialization failed', { error: error.message });
  }
}

// Initialize Query Performance Monitoring
const { initQueryMonitoring } = require('./services/queryPerformanceMonitor');
initQueryMonitoring();
logger.info('✅ Query performance monitoring initialized');

// Initialize Elasticsearch (optional)
const { initElasticsearch } = require('./services/elasticsearchService');
initElasticsearch().catch(err => {
  logger.warn('Elasticsearch initialization failed', { error: err.message });
});

// Initialize CDN
const { initCDN } = require('./services/cdnService');
initCDN().catch(err => {
  logger.warn('CDN initialization failed', { error: err.message });
});

// Initialize database sharding
const { initSharding } = require('./services/databaseShardingService');
initSharding().catch(err => {
  logger.warn('Database sharding initialization failed', { error: err.message });
});

// Initialize monitoring middleware (starts system metrics collection)
require('./middleware/monitoringMiddleware');

// Initialize automated failover
const { initFailoverMonitoring } = require('./services/automatedFailoverService');
initFailoverMonitoring();

// Initialize error handlers
initErrorHandlers();

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

// Auth/API responses must not be served as 304 (ETag cache hits) because the client expects a JSON body.
// Disabling ETag generation prevents Express from returning "Not Modified" for API JSON routes like /api/auth/me.
app.set('etag', false);

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
  } catch {}
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

// Compression middleware
app.use(compression());

// Security headers (must be before other middleware)
app.use(securityHeaders());
app.use(customSecurityHeaders);

// Enhanced security middleware - Input sanitization
const { sanitizeInput } = require('./middleware/inputSanitization');
app.use(sanitizeInput);

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
// Always allow localhost for development
allowedOrigins.push(
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3010',
  'http://localhost:3011',
  'http://localhost:3012',
  'http://127.0.0.1:3010',
  'http://127.0.0.1:3011',
  'http://127.0.0.1:3012'
);
// Allow production frontend if different
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push('https://click-platform.onrender.com');
  // Allow any subdomain of onrender.com for flexibility
  allowedOrigins.push(/^https:\/\/.*\.onrender\.com$/);
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
      console.log('⚠️ CORS blocked origin:', origin);
      console.log('✅ Allowed origins:', allowedOrigins);
      // In development, allow all origins for easier debugging
      if (process.env.NODE_ENV !== 'production') {
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
    'Pragma'
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

// Performance tracking
const { trackPerformance } = require('./middleware/performanceTracking');
app.use(trackPerformance);

// Feature flags middleware
const { featureFlagsMiddleware } = require('./services/featureFlagsService');
app.use(featureFlagsMiddleware);

// API versioning
const { apiVersioning } = require('./middleware/apiVersioning');
app.use('/api', apiVersioning);

// Request timeout (global)
app.use(requestTimeout(getTimeoutForRoute('default')));

// Request logging (before other middleware)
app.use(requestLogger);

// Request timeout (30 seconds default)
app.use(requestTimeout(parseInt(process.env.REQUEST_TIMEOUT) || 30000));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
const { addRequestId } = require('./middleware/requestId');
app.use(addRequestId);

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
app.use('/api', apiOptimizer);

// APM Middleware for performance monitoring
app.use('/api', apmMiddleware);

// Cache middleware for GET requests (skip auth and status endpoints)
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('/auth/me') && !req.path.includes('/status')) {
    const { cacheMiddleware } = require('./middleware/cacheMiddleware');
    return cacheMiddleware(300000)(req, res, next); // 5 minutes cache
  }
  next();
});

// Serve a simple landing page for testing - MUST BE BEFORE OTHER ROUTES
app.get('/', (req, res) => {
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

        <div class="grid">
            <div class="card">
                <h3>🔐 Authentication</h3>
                <p>Test user registration, login, and email verification.</p>
                <button id="show-register-btn" class="btn">Test Registration</button>
                <button id="show-login-btn" class="btn secondary">Test Login</button>
            </div>

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

        <div id="auth-forms" style="display: none; margin-top: 30px; padding: 20px; background: rgba(255, 255, 255, 0.1); border-radius: 10px;">
            <h3 id="form-title" style="color: white; text-align: center;">Register</h3>
            <form id="register-form" style="max-width: 400px; margin: 0 auto;">
                <div style="margin-bottom: 15px;">
                    <input type="email" id="reg-email" placeholder="Email" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="password" id="reg-password" placeholder="Password" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="reg-firstname" placeholder="First Name" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="reg-lastname" placeholder="Last Name" required style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 16px;">
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
            document.getElementById('auth-forms').style.display = 'block';
            document.getElementById('form-title').textContent = 'Register';
            document.getElementById('register-form').style.display = 'block';
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('auth-result').style.display = 'none';
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
                firstName: document.getElementById('reg-firstname').value,
                lastName: document.getElementById('reg-lastname').value
            };

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    resultDiv.style.background = '#10b981';
                    resultDiv.innerHTML = '<strong>✅ Registration Successful!</strong><br>Check your email for verification link.<br><br><strong>JWT Token:</strong><br><code style="background: rgba(0,0,0,0.2); padding: 5px; border-radius: 3px;">' + (result.token || 'Check response below') + '</code><br><br><pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto;">' + JSON.stringify(result, null, 2) + '</pre>';
                    authToken = result.token;
                } else {
                    resultDiv.style.background = '#ef4444';
                    resultDiv.innerHTML = '<strong>❌ Registration Failed:</strong><br>' + (result.error || 'Unknown error') + '<br><br><details><summary>Full Response</summary><pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto;">' + JSON.stringify(result, null, 2) + '</pre></details>';
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
                    resultDiv.innerHTML = '<strong>❌ Login Failed:</strong><br>' + (result.error || 'Unknown error') + '<br><br><details><summary>Full Response</summary><pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto;">' + JSON.stringify(result, null, 2) + '</pre></details>';
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

        // Add event listeners for buttons
        document.getElementById('show-register-btn').addEventListener('click', showRegistrationForm);
        document.getElementById('show-login-btn').addEventListener('click', showLoginForm);
        document.getElementById('view-posts-btn').addEventListener('click', () => testEndpoint('/api/posts', 'GET'));
        document.getElementById('create-post-btn').addEventListener('click', createSamplePost);
        document.getElementById('view-analytics-btn').addEventListener('click', () => testEndpoint('/api/analytics/dashboard', 'GET'));
        document.getElementById('view-performance-btn').addEventListener('click', () => testEndpoint('/api/analytics/performance', 'GET'));
        document.getElementById('connect-twitter-btn').addEventListener('click', () => testEndpoint('/api/oauth/twitter', 'GET'));
        document.getElementById('view-connections-btn').addEventListener('click', () => testEndpoint('/api/oauth/connected-accounts', 'GET'));
        document.getElementById('admin-stats-btn').addEventListener('click', () => testEndpoint('/api/admin/stats', 'GET'));
        document.getElementById('admin-users-btn').addEventListener('click', () => testEndpoint('/api/admin/users', 'GET'));

        // Auto-test health on page load
        window.addEventListener('load', () => {
            setTimeout(testHealth, 1000);
        });
    </script>
</body>
</html>`);
});

// Serve Next.js build files in production (if available)
if (process.env.NODE_ENV === 'production') {
  const nextJsPath = path.join(__dirname, '../client/.next');

  if (fs.existsSync(nextJsPath)) {
    console.log('📦 Next.js build found, serving from:', nextJsPath);
    // Could add Next.js serving logic here if needed
  }
}

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

// Connect to database (non-blocking)
connectDB();

// API Documentation
const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Click API'
};

// Primary docs route (common Swagger default)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Compatibility alias for existing scripts/docs that expect /api/docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Redis Caching Middleware for API routes
// Cache GET requests for better performance
app.use('/api', redisCache.middleware({
  ttl: 300, // 5 minutes default
  skipCache: (req) => {
    // Don't cache non-GET requests, auth routes, or uploads
    return req.method !== 'GET' ||
           req.originalUrl.includes('/auth/') ||
           req.originalUrl.includes('/upload/') ||
           req.originalUrl.includes('/admin/') ||
           req.originalUrl.includes('/batch/') ||
           req.originalUrl.includes('/export/');
  },
  condition: (req) => {
    // Only cache for authenticated users or public routes
    return !!req.user || req.originalUrl.includes('/analytics/');
  }
}));

// Routes
// #region agent log - Route mounting
// #endregion

// Debug middleware for all API requests
app.use('/api', (req, res, next) => {
  // #region agent log - API request received
  // #endregion
  next();
});

// Debug middleware for quote routes
app.use('/api/quote', (req, res, next) => {
  // #region agent log
  // #endregion
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/video', require('./routes/video'));
app.use('/api/content', require('./routes/content'));
app.use('/api/quote', require('./routes/quote'));
app.use('/api/scheduler', require('./routes/scheduler'));
// Analytics routes - more specific first
app.use('/api/analytics/content', require('./routes/analytics/content'));
app.use('/api/analytics/performance', require('./routes/analytics/performance'));
app.use('/api/analytics/growth', require('./routes/analytics/growth'));
app.use('/api/analytics/advanced', require('./routes/analytics/advanced'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/analytics', require('./routes/analytics/advanced-features'));

app.use('/api/niche', require('./routes/niche'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/search', require('./routes/search'));
app.use('/api/export', require('./routes/export'));
app.use('/api/batch', require('./routes/batch'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/music', require('./routes/music'));
app.use('/api/video/effects', require('./routes/video/effects'));
app.use('/api/video/enhance', require('./routes/video/enhance'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/scripts', require('./routes/scripts'));
app.use('/api/versions', require('./routes/versions'));
app.use('/api/collaboration', require('./routes/collaboration'));
app.use('/api/membership', require('./routes/membership'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/subscription', require('./routes/subscription/status'));
app.use('/api/import', require('./routes/import'));
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/library', require('./routes/library'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/social', require('./routes/social'));
app.use('/api/oauth', require('./routes/oauth'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/versions', require('./routes/versions'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/approvals', require('./routes/approvals'));
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
app.use('/api/creative/ideation', require('./routes/creative/ideation'));
app.use('/api/creative/brand-voice', require('./routes/creative/brand-voice'));
app.use('/api/creative/hashtags', require('./routes/creative/hashtags'));
app.use('/api/productive/calendar', require('./routes/productive/calendar'));
app.use('/api/productive/repurposing', require('./routes/productive/repurposing'));
app.use('/api/productive/ab-testing', require('./routes/productive/ab-testing'));
app.use('/api/video/ai-editing', require('./routes/video/ai-editing'));
app.use('/api/video/captions', require('./routes/video/captions'));
app.use('/api/video/effects', require('./routes/video/effects'));
app.use('/api/video/analytics', require('./routes/video/analytics'));
app.use('/api/video/transcription', require('./routes/video/transcription'));
app.use('/api/video/thumbnails', require('./routes/video/thumbnails'));
app.use('/api/video/chapters', require('./routes/video/chapters'));
app.use('/api/video/optimization', require('./routes/video/optimization'));
app.use('/api/debug', require('./routes/debug'));
app.use('/api/ai/multi-model', require('./routes/ai/multi-model'));
app.use('/api/ai/recommendations', require('./routes/ai/recommendations'));
app.use('/api/ai/predictive', require('./routes/ai/predictive'));
app.use('/api/ai/content-generation', require('./routes/ai/content-generation'));
app.use('/api/ai/adapt', require('./routes/ai/adapt'));
app.use('/api/ai', require('./routes/ai/generate-idea'));
app.use('/api/infrastructure/cache', require('./routes/infrastructure/cache'));
app.use('/api/infrastructure/load-balancer', require('./routes/infrastructure/load-balancer'));
app.use('/api/infrastructure/database', require('./routes/infrastructure/database'));
app.use('/api/infrastructure/resources', require('./routes/infrastructure/resources'));
app.use('/api/workflows/advanced', require('./routes/workflows/advanced'));
app.use('/api/workflows/templates', require('./routes/workflows/templates'));

// Mobile app routes (if needed for mobile-specific endpoints)
// app.use('/api/mobile', require('./routes/mobile'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/search', require('./routes/search'));
app.use('/api/search/advanced', require('./routes/search/advanced'));
app.use('/api/search/elasticsearch', require('./routes/search/elasticsearch'));
app.use('/api/suggestions/enhanced', require('./routes/suggestions/enhanced'));
app.use('/api/workflows/enhanced', require('./routes/workflows/enhanced'));
app.use('/api/social', require('./routes/social'));
app.use('/api/ai', require('./routes/ai-recommendations'));
app.use('/api/scheduling', require('./routes/scheduling/advanced'));
app.use('/api/scheduling/advanced', require('./routes/scheduling/advanced'));

// Unified content pipeline routes
app.use('/api/pipeline', require('./routes/pipeline'));

// AI Content Operations routes
app.use('/api/content-operations', require('./routes/content-operations'));

// Enterprise routes
app.use('/api/enterprise', require('./routes/enterprise'));

// Agency routes
app.use('/api/agency', require('./routes/agency'));

// Advanced recycling routes
app.use('/api/recycling-advanced', require('./routes/recycling-advanced'));

// Content Ops API routes
app.use('/api/content-ops', require('./routes/content-ops-api'));

// Webhook routes
app.use('/api/webhooks', require('./routes/webhooks'));

// Integration routes
app.use('/api/integrations', require('./routes/integrations'));

// Event streaming routes
app.use('/api/events', require('./routes/events').router);

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

// Client portal routes
app.use('/api/client-portal', require('./routes/client-portal'));

// Branded links routes
app.use('/api/agency', require('./routes/branded-links'));
app.use('/l', require('./routes/branded-links')); // Public link resolution

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
app.use('/api/support', require('./routes/pricing-enhanced'));

// Export routes
app.use('/api/export', require('./routes/export'));

// Enhanced support routes
app.use('/api/support', require('./routes/support-enhanced'));

// Pro mode routes
app.use('/api/pro-mode', require('./routes/pro-mode'));

// Status page (public)
app.use('/api/status', require('./routes/support-enhanced'));

// Workload dashboard routes
app.use('/api/workload', require('./routes/workload-dashboard'));

// Playbook routes
app.use('/api/playbooks', require('./routes/playbooks'));

// Risk flag routes
app.use('/api/risk-flags', require('./routes/risk-flags'));

// AI content routes
app.use('/api/ai', require('./routes/ai-content'));
app.use('/api/ai', require('./routes/ai-enhanced'));
app.use('/api/moderation', require('./routes/moderation'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/video/advanced', require('./routes/video/advanced'));
app.use('/api/video/progress', require('./routes/video/progress'));
app.use('/api/workflows/webhooks', require('./routes/workflows/webhooks'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/jobs/dashboard', require('./routes/jobs/dashboard'));
app.use('/api/upload/progress', require('./routes/upload/progress').router);
app.use('/api/upload/chunked', require('./routes/upload/chunked'));
app.use('/api/security', require('./routes/security'));
app.use('/api/privacy', require('./routes/privacy'));
app.use('/api/cache', require('./routes/cache'));
app.use('/api/oauth/twitter', require('./routes/oauth/twitter'));
app.use('/api/oauth/linkedin', require('./routes/oauth/linkedin'));
app.use('/api/oauth/facebook', require('./routes/oauth/facebook'));
app.use('/api/oauth/instagram', require('./routes/oauth/instagram'));
app.use('/api/oauth/youtube', require('./routes/oauth/youtube'));
app.use('/api/oauth/tiktok', require('./routes/oauth/tiktok'));
app.use('/api/oauth/health', require('./routes/oauth/health'));
app.use('/api/monitoring/performance', require('./routes/monitoring/performance'));
app.use('/api/monitoring/cache', require('./routes/monitoring/cache'));
app.use('/api/monitoring/database', require('./routes/monitoring/database'));
app.use('/api/analytics/user', require('./routes/analytics/user'));
app.use('/api/transcripts', require('./routes/transcripts'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/translation', require('./routes/translation'));
app.use('/api/feature-flags', require('./routes/feature-flags'));

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
  const limit = parseInt(req.query.limit) || 50
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

// 404 handler
app.use(notFound);

// Sentry error handler - catches errors not handled by custom middleware
app.use(Sentry.expressErrorHandler());

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
    } catch {}
    // #endregion

    const finish = () => {
      // #region agent log
      try {
      } catch {}
      // #endregion

      // Flush Sentry events before shutdown
      try {
        Sentry.close(2000).catch(() => {});
      } catch {}

      // Close mongoose connection if it exists
      try {
        if (mongoose?.connection?.readyState) {
          mongoose.connection.close(false).catch(() => {});
        }
      } catch {}

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
        } catch {}
        // #endregion

        // Force-close idle/active keep-alive connections so the port is released promptly.
        // (prevents nodemon restart races where the old process is still holding the listen socket)
        try { server.closeIdleConnections && server.closeIdleConnections(); } catch {}
        try { server.closeAllConnections && server.closeAllConnections(); } catch {}

        server.close(() => finish());
        return;
      }
    } catch {}
    finish();
  };

  process.once('SIGINT', () => shutdown('SIGINT', false));
  process.once('SIGTERM', () => shutdown('SIGTERM', false));
  // Nodemon restart signal
  process.once('SIGUSR2', () => shutdown('SIGUSR2', true));

  // #region agent log
  process.once('exit', (code) => {
    try {
    } catch {}
  });
  // #endregion
}

__installShutdownHooks();
try {
  // Close health check server before starting main server
  // This ensures the port is free for the main server
  if (healthCheckServer) {
    console.log('📝 Closing health check server, starting main server...');
    healthCheckServer.close(() => {
      console.log('✅ Health check server closed, starting main server...');
      
      try {
        // Start main server after health check server is closed
        server = app.listen(PORT, HOST, () => {
        logger.info(`🚀 Server running on port ${PORT}`);
        logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  
  // Initialize Socket.io for real-time updates
  initializeSocket(server);
  logger.info(`🔌 Socket.io initialized for real-time updates`);

  // Job queue workers are initialized above with the new centralized system
  
      // Schedule file cleanup (runs daily at 2 AM)
      if (process.env.NODE_ENV !== 'test') {
        cron.schedule('0 2 * * *', async () => {
          logger.info('🧹 Running scheduled file cleanup...');
          const uploadsDir = path.join(__dirname, '../uploads');
          await cleanupOldFiles(path.join(uploadsDir, 'videos'), 30); // Keep videos for 30 days
          await cleanupOldFiles(path.join(uploadsDir, 'clips'), 14); // Keep clips for 14 days
          await cleanupOldFiles(path.join(uploadsDir, 'thumbnails'), 14);
          await cleanupOldFiles(path.join(uploadsDir, 'quotes'), 30);
          logger.info('✅ File cleanup completed');
        });
        logger.info('✅ Scheduled file cleanup enabled (daily at 2 AM)');

        // Schedule subscription expiration checks (runs daily at 3 AM)
        cron.schedule('0 3 * * *', async () => {
          logger.info('🔔 Checking subscription expirations...');
          const { processExpiredSubscriptions, sendExpirationWarnings } = require('./services/subscriptionService');
          await processExpiredSubscriptions();
          await sendExpirationWarnings([7, 3, 1]); // Warn 7, 3, and 1 days before
          logger.info('✅ Subscription expiration check completed');
        });
        logger.info('✅ Subscription expiration check enabled (daily at 3 AM)');

        // Schedule expiration warnings (runs every 6 hours)
        cron.schedule('0 */6 * * *', async () => {
          logger.info('📧 Sending subscription expiration warnings...');
          const { sendExpirationWarnings } = require('./services/subscriptionService');
          await sendExpirationWarnings([7, 3, 1]);
          logger.info('✅ Expiration warnings sent');
        });
        logger.info('✅ Expiration warnings enabled (every 6 hours)');

        // Schedule token refresh (runs every hour)
        cron.schedule('0 * * * *', async () => {
          logger.info('🔄 Refreshing social media tokens...');
          const { refreshAllTokens } = require('./services/tokenRefreshService');
          try {
            const result = await refreshAllTokens();
            logger.info(`✅ Token refresh completed: ${result.refreshed} refreshed, ${result.failed} failed`);
          } catch (error) {
            logger.error('❌ Token refresh error', { error: error.message });
          }
        });
        logger.info('✅ Token refresh enabled (hourly)');

        // Schedule automatic backups (runs daily at 4 AM)
        cron.schedule('0 4 * * *', async () => {
          logger.info('💾 Running automatic backups...');
          const { createUserBackup } = require('./services/backupService');
          try {
            // Backup all active users (in production, do this in batches)
            const User = require('./models/User');
            const activeUsers = await User.find({
              'subscription.status': { $in: ['active', 'trial'] },
            }).limit(100); // Process 100 at a time

            let backedUp = 0;
            for (const user of activeUsers) {
              try {
                await createUserBackup(user._id, {
                  includeContent: true,
                  includePosts: true,
                  includeScripts: true,
                  includeSettings: true,
                });
                backedUp++;
              } catch (error) {
                logger.error('Backup failed for user', { userId: user._id, error: error.message });
              }
            }
            logger.info(`✅ Automatic backups completed: ${backedUp} users backed up`);
          } catch (error) {
            logger.error('Automatic backup error', { error: error.message });
          }
        });
        logger.info('✅ Automatic backups enabled (daily at 4 AM)');

        // Schedule cache warming (runs every 6 hours)
        cron.schedule('0 */6 * * *', async () => {
          logger.info('🔥 Warming caches...');
          const { warmAllCaches } = require('./services/cacheWarmingService');
          await warmAllCaches();
          logger.info('✅ Cache warming completed');
        });
        logger.info('✅ Cache warming enabled (every 6 hours)');
      }
      }); // Close app.listen callback
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`❌ Port ${PORT} is already in use. This might be the health check server.`);
          logger.warn('⚠️ Keeping health check server running since main server failed to start');
          // Don't exit - keep health check server running so Render.com can detect the port
          return;
        } else {
          logger.error('Server error:', err);
        }
      });
      
      logger.info(`✅ Server bound to port ${PORT} on ${HOST}`);
      console.log(`✅ Server successfully bound to port ${PORT} on ${HOST}`);
      } catch (listenError) {
        console.error('❌ Error starting main server:', listenError.message);
        console.error('Stack:', listenError.stack);
        logger.error('❌ Error starting main server:', { error: listenError.message, stack: listenError.stack });
        // Keep health check server running so port stays bound
        logger.warn('⚠️ Keeping health check server running since main server failed to start');
        return;
      }
    }); // Close healthCheckServer.close callback
  } else {
    // No health check server, start main server directly
    server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      
      // Initialize Socket.io for real-time updates
      initializeSocket(server);
      logger.info(`🔌 Socket.io initialized for real-time updates`);
      
      logger.info(`✅ Server bound to port ${PORT} on ${HOST}`);
      console.log(`✅ Server successfully bound to port ${PORT} on ${HOST}`);
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use.`);
        process.exit(1);
      } else {
        logger.error('Server error:', err);
      }
    });
  }
} catch (error) {
  logger.error('❌ Failed to start server:', error);
  logger.error('Stack:', error.stack);
  console.error('❌ Failed to start main server:', error.message);
  console.error('Stack:', error.stack);
  
  // Last resort: Create minimal server that just responds to health checks
  console.log('⚠️ Creating minimal fallback server for health checks...');
  logger.warn('⚠️ Creating minimal fallback server for health checks...');
  try {
    const express = require('express');
    const fallbackApp = express();
    
    fallbackApp.get('/api/health', (req, res) => {
      res.json({ 
        status: 'degraded', 
        message: 'Server running in fallback mode. Check logs for errors.',
        error: error.message,
        port: PORT
      });
    });
    
    fallbackApp.get('*', (req, res) => {
      res.status(503).json({ 
        status: 'error', 
        message: 'Server is in fallback mode. Check logs for errors.',
        port: PORT
      });
    });
    
    const fallbackServer = fallbackApp.listen(PORT, HOST, () => {
      console.log(`✅ Fallback server running on port ${PORT}`);
      console.log(`✅ Server bound to ${HOST}:${PORT}`);
      console.log(`⚠️ Server is in degraded mode. Check logs for errors.`);
      logger.info(`✅ Fallback server bound to port ${PORT} on ${HOST}`);
    });
    
    fallbackServer.on('error', (err) => {
      console.error('❌ Even fallback server failed:', err);
      console.error('Error code:', err.code);
      logger.error('❌ Even fallback server failed:', err);
      process.exit(1);
    });
    
    // Keep process alive
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      fallbackServer.close(() => {
        console.log('Fallback server closed');
        process.exit(0);
      });
    });
  } catch (fallbackError) {
    console.error('❌ Even fallback server failed:', fallbackError);
    logger.error('❌ Even fallback server failed:', fallbackError);
    process.exit(1);
  }
}


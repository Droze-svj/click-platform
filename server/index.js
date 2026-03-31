// Log that we're starting
console.log('🚀 Starting server...');
console.log('📝 Node version:', process.version);
console.log('📝 Working directory:', process.cwd());
console.log('📝 PORT environment variable:', process.env.PORT || 'NOT SET (will use 5001)');
console.log('📝 NODE_ENV (before .env):', process.env.NODE_ENV || 'NOT SET');

// Load environment variables FIRST before anything else.
// Always load from project root (parent of server/) so it works when run via `node index.js` from server/ or `npm start` from root.
console.log('📦 Loading environment variables...');
const path = require('path');
const fs = require('fs');

// Load root environment variables
const rootEnv = path.join(__dirname, '..', '.env.nosync');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

// Also load local server environment variables if they exist (common for some deployments)
const serverEnv = path.join(__dirname, '.env');
const serverEnvNoSync = path.join(__dirname, '.env.nosync');
if (fs.existsSync(serverEnvNoSync)) {
  require('dotenv').config({ path: serverEnvNoSync });
} else if (fs.existsSync(serverEnv)) {
  require('dotenv').config({ path: serverEnv });
}

// Optional: override with .env.local.nosync at root if present
const localEnv = path.join(__dirname, '..', '.env.local.nosync');
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
} else {
  const localEnvStandard = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(localEnvStandard)) {
    require('dotenv').config({ path: localEnvStandard });
  }
}
console.log('✅ Environment variables loaded');
console.log('📝 NODE_ENV (after .env):', process.env.NODE_ENV || 'NOT SET (defaulting to development behavior)');

// Initialize logger early (needed for error handlers)
console.log('REQUIRING LOGGER');
const logger = require('./utils/logger');
console.log('LOGGER REQUIRED');

// Lazy require helper to combat slow external drive I/O
const lazyRequire = (modulePath) => {
  let moduleInstance = null;
  return new Proxy(() => {}, {
    apply: (target, thisArg, args) => {
      if (!moduleInstance) {
        console.log(`📦 Lazy loading: ${modulePath}`);
        moduleInstance = require(modulePath);
      }
      return moduleInstance(...args);
    },
    get: (target, prop) => {
      if (!moduleInstance) {
        console.log(`📦 Lazy accessing: ${modulePath}.${String(prop)}`);
        moduleInstance = require(modulePath);
      }
      return moduleInstance[prop];
    }
  });
};

let Sentry = null;
console.log('⚠️ Sentry initialization bypassed to prevent hangs.');

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

console.log('REQUIRING EXPRESS'); const express = require('express');
console.log('REQUIRING CORS'); const cors = require('cors');
console.log('LAZY LOADING MONGOOSE'); const mongoose = lazyRequire('mongoose');
console.log('LAZY LOADING COMPRESSION'); const compression = lazyRequire('compression');
console.log('REQUIRING SECURITY HEADERS'); const { securityHeaders, customSecurityHeaders } = require('./middleware/securityHeaders');
console.log('LAZY LOADING CRON'); const cron = lazyRequire('node-cron');
console.log('LAZY LOADING SWAGGER'); const swaggerUi = lazyRequire('swagger-ui-express');
let swaggerSpec = null;
try {
  console.log('REQUIRING SWAGGER CONFIG');
  swaggerSpec = require('./config/swagger');
  console.log('SWAGGER CONFIG REQUIRED');
} catch (err) {
  logger.warn('Swagger docs disabled (missing z-schema?). Run: npm install z-schema', { error: err.message });
  swaggerSpec = { openapi: '3.0.0', info: { title: 'Click API', version: '1.0.0' }, paths: {} };
}
console.log('REQUIRING VALIDATE ENV'); const validateEnv = require('./middleware/validateEnv'); console.log('VALIDATE ENV REQUIRED');
console.log('REQUIRING ERROR HANDLERS');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initErrorHandlers } = require('./middleware/enhancedErrorHandler');
// Note: enhancedErrorHandler and notFoundHandler are exported but not used — original handlers are used below
console.log('ERROR HANDLERS REQUIRED');
const { apiLimiter } = require('./middleware/enhancedRateLimiter');
console.log('REQUIRING REQUEST LOGGER'); const requestLogger = require('./middleware/requestLogger'); console.log('REQUEST LOGGER REQUIRED');
console.log('REQUIRING REQUEST TIMEOUT'); const { requestTimeoutRouteAware, getTimeoutForRoute } = require('./middleware/requestTimeout'); console.log('REQUEST TIMEOUT REQUIRED');
console.log('REQUIRING FILE CLEANUP'); const { cleanupOldFiles } = require('./utils/fileCleanup'); console.log('FILE CLEANUP REQUIRED');
// logger is already imported above (needed for error handlers)
console.log('REQUIRING SOCKET'); const { initializeSocket } = require('./services/socketService'); console.log('SOCKET REQUIRED');
console.log('REQUIRING PERFORMANCE'); require('./utils/performance'); console.log('PERFORMANCE REQUIRED');

// Sentry is already initialized at the top of the file (before error handlers)
// Don't initialize again to avoid duplicate initialization
// const { initSentry } = require('./utils/sentry');
// initSentry();

// Initialize Email Service
try {
  console.log('REQUIRING EMAIL SERVICE');
  const { initEmailService } = require('./services/emailService');
  initEmailService();
  console.log('EMAIL SERVICE INITIALIZED');
} catch (error) {
  logger.warn('Email service initialization failed', { error: error.message });
}

// Initialize Cache Service
console.log('INITIALIZING CACHE');
const { initCache } = require('./services/cacheService');
initCache().then(() => console.log('CACHE INITIALIZED')).catch(err => {
  logger.warn('Cache initialization failed', { error: err.message });
});

// Initialize Intelligent Cache Service
try {
  const { initIntelligentCache } = require('./services/intelligentCacheService');
  initIntelligentCache();
  logger.info('✅ Intelligent cache service initialized');
} catch (error) {
  logger.warn('Intelligent cache service initialization failed', { error: error.message });
}

// Initialize Redis Cache Service
let redisCache = null;
try {
  redisCache = require('./utils/redisCache');
  logger.info('✅ Redis cache service initialized');
} catch (error) {
  logger.warn('Redis cache service initialization failed', { error: error.message });
  redisCache = null;
}

// Initialize APM (Application Performance Monitoring)
let apmMiddleware = null;
try {
  console.log('REQUIRING APM');
  const { apmMonitor, apmMiddleware: apmMiddlewareExport } = require('./utils/apm');
  global.apmMonitor = apmMonitor; // Make available globally for error handlers
  apmMiddleware = apmMiddlewareExport; // Assign to outer scope
  logger.info('✅ APM monitoring service initialized');
} catch (error) {
  logger.warn('APM monitoring service initialization failed', { error: error.message });
  global.apmMonitor = null;
  apmMiddleware = null;
}

// Initialize Alerting System
try {
  console.log('REQUIRING ALERTING');
  const alertingSystem = require('./utils/alerting');
  global.alertingSystem = alertingSystem;
  logger.info('✅ Alerting system initialized');
} catch (error) {
  logger.warn('Alerting system initialization failed', { error: error.message });
  global.alertingSystem = null;
}

// Initialize API Optimization Middleware
let apiOptimizer = null;
try {
  console.log('REQUIRING API OPTIMIZER');
  apiOptimizer = require('./middleware/apiOptimizer');
  logger.info('✅ API optimization middleware loaded');
} catch (error) {
  logger.warn('API optimization middleware initialization failed', { error: error.message });
  apiOptimizer = null;
}

// Initialize Database Optimizer
try {
  console.log('REQUIRING DB OPTIMIZER');
  require('./utils/databaseOptimizer');
  logger.info('✅ Database optimizer loaded');
} catch (error) {
  logger.warn('Database optimizer initialization failed', { error: error.message });
}

// Connect to database (supports multiple providers)
const connectDB = async () => {
  try {
    console.log('🏗️ Starting database initialization...');
    const { initDatabases } = require('./config/database');
    console.log('🏗️ Calling initDatabases...');
    const dbStatus = await initDatabases();
    console.log('🏗️ initDatabases completed:', dbStatus.success ? 'SUCCESS' : 'FAILED');

    if (dbStatus.supabase || dbStatus.prisma || dbStatus.mongodb) {
      logger.info('✅ Database connected successfully');
    } else {
      logger.error('❌ No database connection available');
      logger.warn('⚠️ Server will start in degraded mode. Database features will not work.');
    }
  } catch (err) {
    logger.error('❌ Database connection error:', err);
    logger.warn('⚠️ Server will start without database. Connection will retry in background.');
  }
};

// Initialize database connection
connectDB();

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
    } else if (redisUrl.includes('placeholder')) {
      logger.warn('⚠️ REDIS_URL appears to be a placeholder. Set a real Redis URL in Render. Workers disabled.');
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
      } else if (finalRedisUrlCheck.includes('placeholder')) {
        logger.warn('⚠️ REDIS_URL is placeholder. Skipping worker initialization.');
        shouldInitializeWorkers = false;
      } else {
        console.log('✅ Final REDIS_URL validation passed. Proceeding with worker initialization...');
      }
    }

    const backgroundJobsEnabled = process.env.ENABLE_BACKGROUND_JOBS !== 'false';
    const jobSchedulerEnabled = process.env.ENABLE_JOB_SCHEDULER !== 'false';

    if (!backgroundJobsEnabled) {
      logger.info('⏭️ Background jobs disabled via ENABLE_BACKGROUND_JOBS=false. Skipping worker initialization.');
    } else if (shouldInitializeWorkers) {
      try {
        const { initializeWorkers } = require('./queues');
        const { initializeScheduler } = require('./services/jobScheduler');
        initializeWorkers();
        if (jobSchedulerEnabled) {
          initializeScheduler();
        } else {
          logger.info('⏭️ Job scheduler disabled via ENABLE_JOB_SCHEDULER=false.');
        }
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

console.log('REQUIRING SCHEDULED REPORTS');
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

console.log('REQUIRING QUERY MONITORING');
// Initialize Query Performance Monitoring
try {
  const { initQueryMonitoring } = require('./services/queryPerformanceMonitor');
  initQueryMonitoring();
  logger.info('✅ Query performance monitoring initialized');
} catch (error) {
  logger.warn('Query performance monitoring initialization failed', { error: error.message });
}

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
try {
  require('./middleware/monitoringMiddleware');
} catch (error) {
  logger.warn('Monitoring middleware initialization failed', { error: error.message });
}

// Initialize automated failover
try {
  const { initFailoverMonitoring } = require('./services/automatedFailoverService');
  initFailoverMonitoring();
} catch (error) {
  logger.warn('Automated failover initialization failed', { error: error.message });
}

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

// EARLIEST POSSIBLE request logging - must be first to catch ALL requests
// Note: Using console.log here for early logging before logger is fully initialized
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
    res.on('finish', () => {
      logger.debug(`${startPath} completed in ${Date.now() - start}ms`);
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
const { sanitizeInput } = require('./middleware/inputSanitization');
app.use(sanitizeInput);

// CSRF Protection (after body parsing) - temporarily disabled for auth testing
// const { csrfProtection } = require('./middleware/csrfProtection');
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
  allowedOrigins.push('https://sovereign-platform.onrender.com');
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
const { addRequestId } = require('./middleware/requestId');
app.use(addRequestId);

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
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      logger.debug(`Auth route took ${durationMs}ms`);
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

// Cache middleware for GET requests (skip auth and status endpoints)
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('/auth/me') && !req.path.includes('/status')) {
    const { cacheMiddleware } = require('./middleware/cacheMiddleware');
    return cacheMiddleware(300000)(req, res, next); // 5 minutes cache
  }
  next();
});

// Serve a simple landing page for testing - MUST BE BEFORE OTHER ROUTES

// Serve Next.js build files in production (if available)
// Next.js serving logic moved to route definitions

// Database connection with multi-provider support
// Connection is initialized earlier in the file to ensure models can connect
// getDatabaseHealth available via: require('./config/database').getDatabaseHealth()

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
}

// Serve static files from uploads directory (for videos, images, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes

// Debug middleware for all API requests
app.use('/api', (req, res, next) => {
  next();
});

// Debug middleware for quote routes
app.use('/api/quote', (req, res, next) => {
  next();
});

// ─── Safe Route Loader ──────────────────────────────────────────────────────
// iCloud Drive sometimes cancels file reads (ECANCELED) mid-require(), which
// would normally crash the server with an uncaught exception. console.log("Loading route..."); safeUse() wraps
// each route require() in a try/catch so a single failed route load is logged
// and skipped rather than bringing down the entire process.
function safeUse(mountPath, routeFile) {
  try {
    const mod = require(routeFile);
    // Validate it's actually a middleware/router before mounting
    if (typeof mod !== 'function' && !(mod && typeof mod.handle === 'function')) {
      logger.warn(`⚠️ Route ${routeFile} does not export a valid middleware/router (got ${typeof mod}). Skipping mount at ${mountPath}.`);
      return;
    }
    app.use(mountPath, mod);
  } catch (err) {
    logger.warn(`⚠️ Failed to load route ${routeFile} at ${mountPath}: ${err.message}. Skipping.`);
  }
}
// ────────────────────────────────────────────────────────────────────────────

// Sentry AI Agent Monitoring: group multi-step AI calls by conversation/session/user.
const sentryConversation = require('./middleware/sentryConversation');
app.use('/api/ai', sentryConversation);
app.use('/api/creative/ideation', sentryConversation);
app.use('/api/content-operations', sentryConversation);
app.use('/api/pipeline', sentryConversation);

// ── API Routes (v1) ──────────────────────────────────────────────────────────
const routes = [
  // Auth & User
  ['/api/auth', './routes/auth'],
  ['/api/user', './routes/user'],
  ['/api/teams', './routes/teams'],
  ['/api/onboarding', './routes/onboarding'],
  ['/api/membership', './routes/membership'],
  ['/api/subscription', './routes/subscription'],
  ['/api/subscription/status', './routes/subscription/status'],

  // Core Features
  ['/api/dashboard', './routes/dashboard'],
  ['/api/tasks', './routes/tasks'],
  ['/api/pm', './routes/pm'],
  ['/api/content', './routes/content'],
  ['/api/posts', './routes/posts'],
  ['/api/library', './routes/library'],
  ['/api/assets', './routes/assets'],
  ['/api/templates', './routes/templates'],
  ['/api/workflows', './routes/workflows'],

  // Video Suite
  ['/api/video/analytics', './routes/video/analytics'],
  ['/api/video/transcription', './routes/video/transcription'],
  ['/api/video/hook-analysis', './routes/video/hook-analysis'],
  ['/api/video/thumbnails', './routes/video/thumbnails'],
  ['/api/video/chapters', './routes/video/chapters'],
  ['/api/video/optimization', './routes/video/optimization'],
  ['/api/video/progress', './routes/video/progress'],
  ['/api/video/advanced', './routes/video/advanced'],
  ['/api/video/ai-editing', './routes/video/ai-editing'],
  ['/api/video/manual-editing', './routes/video/manual-editing'],
  ['/api/video/voice-hooks', './routes/video/voice-hooks'],
  ['/api/video/captions', './routes/video/captions'],
  ['/api/video/advanced-editing', './routes/video/advanced-editing'],
  ['/api/video/neural', './routes/video/neural'],
  ['/api/video/effects', './routes/video/effects'],
  ['/api/video/enhance', './routes/video/enhance'],
  ['/api/video/creative', './routes/creative'],
  ['/api/video', './routes/video'],

  // AI & Analytics
  ['/api/analytics/content', './routes/analytics/content'],
  ['/api/analytics/performance', './routes/analytics/performance'],
  ['/api/analytics/growth', './routes/analytics/growth'],
  ['/api/analytics/advanced', './routes/analytics/advanced'],
  ['/api/analytics/predictions', './routes/analytics/predictions'],
  ['/api/analytics/user', './routes/analytics/user'],
  ['/api/analytics', './routes/analytics'],
  ['/api/ai/recommendations', './routes/ai-recommendations'],
  ['/api/ai', './routes/ai/generate-idea'],
  ['/api/ai', './routes/ai-content'],
  ['/api/ai', './routes/ai-enhanced'],
  
  // Others
  ['/api/upload', './routes/upload'],
  ['/api/upload/progress', './routes/upload/progress'],
  ['/api/search', './routes/search'],
  ['/api/search/advanced', './routes/search/advanced'],
  ['/api/export', './routes/export'],
  ['/api/social', './routes/social'],
  ['/api/oauth/linkedin', './routes/oauth/linkedin'],
  ['/api/oauth/facebook', './routes/oauth/facebook'],
  ['/api/oauth/instagram', './routes/oauth/instagram'],
  ['/api/oauth/tiktok', './routes/oauth/tiktok'],
  ['/api/oauth/youtube', './routes/oauth/youtube'],
  ['/api/oauth', './routes/oauth'],
  ['/api/webhooks', './routes/webhooks'],
  ['/api/billing', './routes/billing'],
  ['/api/notifications', './routes/notifications'],
  ['/api/approvals', './routes/approvals'],
  ['/api/comments', './routes/comments'],
  ['/api/help', './routes/help-center'],
  ['/api/admin/dashboard', './routes/admin/dashboard'],
  ['/api/admin', './routes/admin'],
  ['/api/debug', './routes/debug'],
  ['/api/health', './routes/health'],
  ['/api/agentic', './routes/agentic'],
  ['/api/dubbing', './routes/dubbing'],
  ['/api/retention-heatmap', './routes/retention-heatmap'],
  ['/api/competitive', './routes/competitive-benchmark'],
  ['/api/digital-twin', './routes/digitalTwin'],
  
  // Scene Detection Sub-Routes
  ['/api/video/scenes', './routes/video/scenes'],
  ['/api/video/scenes', './routes/video/scenes-advanced'],
  ['/api/video/scenes', './routes/video/scenes-analytics'],
  
  // Audio & Music Features
  ['/api/music', './routes/music'],
  ['/api/music', './routes/music-user-uploads'],
  ['/api/audio/transcription', './routes/transcripts'],
  
  // Analytics & Intelligence
  ['/api/usage-analytics', './routes/usage-analytics'],

  // 2026 Global Marketing AI Expert
  ['/api/marketing-intelligence', './routes/marketing-intelligence'],
  ['/api/intelligence', './routes/intelligence'],
];

// Load routes
routes.forEach(([path, file]) => {
  console.log(`Loading route: ${path} -> ${file}...`);
  safeUse(path, file);
});
// ────────────────────────────────────────────────────────────────────────────

// Health Check Routes - Handled directly by Express
app.get('/api/health-status', (req, res) => {
  res.json({
    status: 'healthy',
    mode: 'express-native'
  });
});

// Monitoring and Health Metrics
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

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

// --- Next.js Integration for Production ---
if (process.env.NODE_ENV === 'production') {
  const next = require('../client/node_modules/next');
  const nextApp = next({ dev: false, dir: path.join(__dirname, '../client') });
  const handle = nextApp.getRequestHandler();

  nextApp.prepare().then(() => {
    logger.info('📦 Next.js engine prepared for production');
    // We use a catch-all for everything that wasn't an API route
    app.all('*', (req, res) => {
      // If it's an API route that reached here, it means it wasn't handled by Express
      if (req.path.startsWith('/api/') || req.path === '/api') {
        return res.status(404).json({ 
          error: 'API_NOT_FOUND',
          path: req.path,
          message: 'Requested API endpoint does not exist on this Sovereign cluster.'
        });
      }
      return handle(req, res);
    });
  }).catch(err => {
    logger.error('❌ Next.js preparation failed:', { 
      message: err.message, 
      stack: err.stack,
      error: err
    });
    // Fallback if Next.js fails to prepare
    app.get('*', (req, res) => {
       res.status(500).send('Sovereign Unified Interface Initialization Failed. Check Nexus Logs.');
    });
  });
}

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

    const finish = () => {

      // Flush Sentry events before shutdown
      if (Sentry && typeof Sentry.close === 'function') {
        try {
          Sentry.close(2000).catch(() => { /* no-op */ });
        } catch { /* no-op – Sentry may not be loaded */ }
      }

      // Close mongoose connection if it exists
      try {
        if (mongoose?.connection?.readyState) {
          mongoose.connection.close(false).catch(() => { /* no-op */ });
        }
      } catch { /* no-op – Mongoose may not be connected */ }

      if (isNodemonRestart) {
        // Hand control back to nodemon
        try { process.kill(process.pid, 'SIGUSR2'); } catch { process.exit(0); }
      } else {
        process.exit(0);
      }
    };

    try {
      if (server && server.listening) {

        // Force-close idle/active keep-alive connections so the port is released promptly.
        // (prevents nodemon restart races where the old process is still holding the listen socket)
        try { server.closeIdleConnections && server.closeIdleConnections(); } catch { /* no-op */ }
        try { server.closeAllConnections && server.closeAllConnections(); } catch { /* no-op */ }

        server.close(() => finish());
        return;
      }
    } catch { /* no-op – server may not be listening */ }
    finish();
  };

  process.once('SIGINT', () => shutdown('SIGINT', false));
  process.once('SIGTERM', () => shutdown('SIGTERM', false));
  // Nodemon restart signal
  process.once('SIGUSR2', () => shutdown('SIGUSR2', true));

}

__installShutdownHooks();
try {
  // Close health check server before starting main server
  // This ensures the port is free for the main server
  if (healthCheckServer && healthCheckServer.listening) {
    logger.info('Closing health check server, starting main server...');
    // Wait a bit for the server to fully close before starting main server
    healthCheckServer.close(() => {
      logger.info('Health check server closed, starting main server...');

      // Add small delay to ensure port is fully released (500ms should be sufficient)
      setTimeout(() => {
        try {
          // Start main server after health check server is closed
console.log('🏁 Starting route loading...');
console.log("Loading route..."); safeUse('/api/auth', './routes/auth');
// ... many routes ...
console.log('🏁 Route loading completed. Initializing servers...');
console.log('🚀 Starting app.listen...');
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
        } catch (listenError) {
          console.error('❌ Error starting main server:', listenError.message);
          console.error('Stack:', listenError.stack);
          logger.error('❌ Error starting main server:', { error: listenError.message, stack: listenError.stack });
          // Keep health check server running so port stays bound
          logger.warn('⚠️ Keeping health check server running since main server failed to start');
          return;
        }
      }, 100); // Small delay to ensure port is fully released
    }); // Close healthCheckServer.close callback
  } else {
    // No health check server, start main server directly
    // Helper: start the main server
    const startMainServer = () => {
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
          logger.error(`❌ Port ${PORT} is already in use. Attempting to free it...`);
          // Try to kill any process using this port (excluding our own PID)
          const { execSync } = require('child_process');
          try {
            execSync(`lsof -ti:${PORT} | grep -v ${process.pid} | xargs kill -9 2>/dev/null || true`, { timeout: 2000 });
            logger.info(`✅ Attempted to free port ${PORT}`);
            logger.warn('⚠️ Please restart the server manually or wait for nodemon to restart.');
          } catch (e) {
            logger.error(`❌ Could not free port ${PORT}. Please manually kill processes using this port.`);
          }
        } else {
          logger.error('Server error:', err);
        }
      });
    }

    // Check if port is available before attempting to bind
    const net = require('net');
    const tester = net.createServer();
    tester.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`⚠️ Port ${PORT} is in use. Attempting to free it...`);
        const { execSync } = require('child_process');
        try {
          execSync(`lsof -ti:${PORT} | grep -v ${process.pid} | xargs kill -9 2>/dev/null || true`, { timeout: 2000 });
          logger.info(`✅ Attempted to free port ${PORT}, waiting 1 second before starting server...`);
          setTimeout(startMainServer, 1000);
        } catch (e) {
          logger.error(`❌ Could not free port ${PORT}. Server will attempt to start anyway.`);
          setTimeout(startMainServer, 2000); // Wait and try anyway
        }
      } else {
        logger.error('Port check error:', err);
        startMainServer(); // Try to start anyway
      }
    });

    tester.once('listening', () => {
      tester.once('close', () => {
        // Port is available, start server immediately
        startMainServer();
      }).close();
    });

    tester.listen(PORT);
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
    console.log('REQUIRING EXPRESS'); const express = require('express');
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


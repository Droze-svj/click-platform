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
  // Don't exit immediately - try to start server for health checks
  console.error('⚠️ Attempting to start server despite error...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - try to start server anyway
  console.error('⚠️ Attempting to start server despite error...');
});

console.log('📦 Loading environment variables...');
require('dotenv').config();
console.log('✅ Environment variables loaded');

// Start minimal health check server IMMEDIATELY using Node's built-in http module
// This MUST happen before ANY other requires to ensure port is bound
// Using http module (no dependencies) for maximum reliability
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';
console.log(`📝 Starting health check server on port ${PORT}...`);

let healthCheckServer = null;
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
  // This is critical - if we can't start the health check server, Render.com won't detect the port
  // But we still don't exit - let the main server try to start
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const { securityHeaders, customSecurityHeaders } = require('./middleware/securityHeaders');
const cron = require('node-cron');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const validateEnv = require('./middleware/validateEnv');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { enhancedErrorHandler, notFoundHandler, initErrorHandlers } = require('./middleware/enhancedErrorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
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

// Initialize Job Queue Workers (optional - non-blocking)
// Check Redis configuration first
const redisUrl = process.env.REDIS_URL?.trim();
const redisHost = process.env.REDIS_HOST?.trim();

logger.info('🔍 Checking Redis for job queues...', {
  hasRedisUrl: !!redisUrl,
  hasRedisHost: !!redisHost,
  redisUrlLength: redisUrl?.length || 0
});

if (process.env.NODE_ENV !== 'test') {
  // Only initialize workers if Redis is properly configured
  // In production/staging, require REDIS_URL (not REDIS_HOST fallback)
  const shouldInitializeWorkers = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')
    ? (redisUrl && redisUrl !== '' && (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')))
    : (redisUrl || redisHost);
  
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
    logger.warn('⚠️ Redis not configured. Skipping job queue workers initialization.');
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
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

// Compression middleware
app.use(compression());

// Security headers (must be before other middleware)
app.use(securityHeaders());
app.use(customSecurityHeaders);

// Enhanced security middleware - Input sanitization
const { sanitizeInput } = require('./middleware/inputSanitization');
app.use(sanitizeInput);

// CSRF Protection (after body parsing)
const { csrfProtection } = require('./middleware/csrfProtection');
app.use('/api', csrfProtection);

// CORS middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
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

// Rate limiting (applied to all routes)
app.use('/api', apiLimiter);

// Cache middleware for GET requests (skip auth and status endpoints)
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('/auth/me') && !req.path.includes('/status')) {
    const { cacheMiddleware } = require('./middleware/cacheMiddleware');
    return cacheMiddleware(300000)(req, res, next); // 5 minutes cache
  }
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Database connection with error handling
// Start server even if MongoDB fails initially
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click');
    logger.info('✅ MongoDB connected');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (err) {
    logger.error('❌ MongoDB connection error:', err);
    logger.warn('⚠️ Server will start without database. MongoDB connection will retry in background.');
    // Don't exit - allow server to start and retry connection
  }
};

// Connect to database (non-blocking)
connectDB();

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Click API'
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/video', require('./routes/video'));
app.use('/api/content', require('./routes/content'));
app.use('/api/quote', require('./routes/quote'));
app.use('/api/scheduler', require('./routes/scheduler'));
app.use('/api/analytics', require('./routes/analytics'));
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
app.use('/api/analytics/advanced', require('./routes/analytics/advanced'));
app.use('/api/membership', require('./routes/membership'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/subscription', require('./routes/subscription/status'));
app.use('/api/analytics/performance', require('./routes/analytics/performance'));
app.use('/api/analytics/content', require('./routes/analytics/content'));
app.use('/api/analytics/growth', require('./routes/analytics/growth'));
app.use('/api/analytics', require('./routes/analytics/advanced-features'));
app.use('/api/export', require('./routes/export'));
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

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

// Always bind to port, even if some services failed to initialize
let server;
try {
  // Close health check server before starting main server
  // This ensures the port is free for the main server
  if (healthCheckServer) {
    console.log('📝 Closing health check server, starting main server...');
    healthCheckServer.close(() => {
      console.log('✅ Health check server closed, starting main server...');
      
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


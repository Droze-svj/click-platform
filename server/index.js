// ─── STAGE 0: SYSTEM INITIALIZATION ─────────────────────────────────────────
console.log('🚀 Nexus Cluster Stage 0: Initializing core...');
const path = require('path');
const fs = require('fs');

// Load environment variables IMMEDIATELY
const rootEnv = path.join(__dirname, '..', '.env.nosync');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

// Minimal Express Setup
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

// ─── STAGE 1: EMERGENCY PORT BINDING ────────────────────────────────────────
// Satisfying Render.com's port detection instantly
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Nexus Cluster Stage 1: Port ${PORT} Bound [READY]`);
  console.log(`✅ Health probes active at /api/status/health-pro`);
});

// Immediate health check response (minimal, no dependencies)
app.get('/api/status/health-pro', (req, res) => {
  res.status(200).json({
    status: 'active',
    stage: 1,
    id: 'sovereign-calibration-node',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    node: process.version
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'active', stage: 1, message: 'Nexus Cluster Port Bound' });
});

// Primary logger initialization (after port is bound)
const logger = require('./utils/logger');
logger.info('🚀 Stage 1 completed. Moving to Stage 2 (Asynchronous Engine Load)...');

// Lazy require helper to battle drive I/O overhead
const lazyRequire = (modulePath) => {
  let moduleInstance = null;
  return new Proxy(() => {}, {
    apply: (target, thisArg, args) => {
      if (!moduleInstance) {
        moduleInstance = require(modulePath);
      }
      return moduleInstance(...args);
    },
    get: (target, prop) => {
      if (!moduleInstance) {
        moduleInstance = require(modulePath);
      }
      return moduleInstance[prop];
    }
  });
};

// ─── STAGE 2: ASYNC ENGINE LOAD ─────────────────────────────────────────────
async function initializeNexusEngine() {
  try {
    logger.info('📦 Loading platform services...');

    // Imports
    const cors = require('cors');
    const mongoose = require('mongoose');
    const compression = require('compression');
    const { securityHeaders, customSecurityHeaders } = require('./middleware/securityHeaders');
    const cron = require('node-cron');
    const swaggerUi = require('swagger-ui-express');
    const validateEnv = require('./middleware/validateEnv');
    const { errorHandler, notFound } = require('./middleware/errorHandler');
    const { initErrorHandlers } = require('./middleware/enhancedErrorHandler');
    const { apiLimiter } = require('./middleware/enhancedRateLimiter');
    const requestLogger = require('./middleware/requestLogger');
    const { requestTimeoutRouteAware, getTimeoutForRoute } = require('./middleware/requestTimeout');
    const { cleanupOldFiles } = require('./utils/fileCleanup');
    const { initializeSocket } = require('./services/socketService');

    let Sentry = null;
    logger.info('⚠️ Sentry initialization bypassed to prevent hangs.');

    // Global error handlers
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', { error: error.message, stack: error.stack });
      if (process.env.NODE_ENV === 'production') {
        logger.error('⚠️ Uncaught exception in production - exiting to prevent undefined behavior');
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      if (reason && typeof reason === 'object' && reason.message &&
        reason.message.includes('ECONNREFUSED') && reason.message.includes('127.0.0.1:6379')) {
        return;
      }
      logger.warn('⚠️ Unhandled Rejection detected - server will continue');
    });

    // Database Initialization
    const { initDatabases } = require('./config/database');
    const dbStatus = await initDatabases();
    logger.info('🏗️ Database initialization completed', { success: dbStatus.success });

    // Job Queue Workers (Optional)
    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl && redisUrl.startsWith('redis')) {
      try {
        const { initializeWorkers } = require('./queues');
        initializeWorkers();
        logger.info('✅ Job queue system initialized');
      } catch (err) {
        logger.warn('Job queue initialization failed (non-fatal)', { error: err.message });
      }
    }

    // --- Start Middleware Setup ---
    app.set('etag', false);
    app.use(compression());
    app.use(securityHeaders());
    app.use(customSecurityHeaders);

    const { sanitizeInput } = require('./middleware/inputSanitization');
    app.use(sanitizeInput);

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000', 'http://localhost:3010',
      'https://sovereign-platform.onrender.com'
    ].filter(Boolean);

    app.use(cors({
      origin: (origin, cb) => !origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked')),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Auth-Token'],
      maxAge: 86400
    }));

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Routes Definition
    const { apiVersioning } = require('./middleware/apiVersioning');
    app.use('/api', apiVersioning);

    // Primary Routes
    const safeUse = (mountPath, routeFile) => {
      try {
        const mod = require(routeFile);
        app.use(mountPath, mod);
      } catch (err) {
        logger.warn(`⚠️ Failed to load route ${routeFile}: ${err.message}`);
      }
    };

    // Load API routes
    const routes = [
      ['/api/auth', './routes/auth'],
      ['/api/user', './routes/user'],
      ['/api/dashboard', './routes/dashboard'],
      ['/api/video', './routes/video'],
      ['/api/ai', './routes/ai-content'],
      ['/api/health', './routes/health'],
      ['/api/status/production-mode', (req, res) => res.json({ status: 'ready', engine: 'Next.js 14' })]
    ];
    routes.forEach(([path, file]) => typeof file === 'string' ? safeUse(path, file) : app.get(path, file));

    // --- Next.js Integration ---
    if (process.env.NODE_ENV === 'production') {
      try {
        const next = require('../client/node_modules/next');
        const nextApp = next({ dev: false, dir: path.join(__dirname, '../client') });
        const handle = nextApp.getRequestHandler();
        
        nextApp.prepare().then(() => {
          logger.info('📦 Next.js engine prepared for production');
          app.all('*', (req, res) => handle(req, res));
        });
      } catch (e) {
        logger.error('❌ Failed to load Next.js module', { error: e.message });
      }
    }

    // Final socket.io init
    initializeSocket(server);
    logger.info('🚀 Nexus Cluster Stage 2: Initialized [FULL ENGINE]');

  } catch (err) {
    logger.error('❌ Stage 2 Initialization Failed:', { error: err.message, stack: err.stack });
  }
}

// Install shutdown hooks
process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

// EXECUTE
initializeNexusEngine();

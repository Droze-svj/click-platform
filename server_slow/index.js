console.log('[EMERGENCY-DEBUG] server/index.js starting...');
// ─── STAGE 0: SYSTEM INITIALIZATION ─────────────────────────────────────────

const path = require('path');
const fs = require('fs');

console.log('[DEBUG] Loading environment variables...');
// Load environment variables IMMEDIATELY
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.nosync';
const envPath = path.join(__dirname, '..', envFile);

if (fs.existsSync(envPath)) {
  console.log(`[DEBUG] Loading env from ${envPath}`);
  require('dotenv').config({ path: envPath });
} else {
  console.log('[DEBUG] Loading env from .env fallback');
  // Fallback to .env if specific environment file doesn't exist
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}
console.log('[DEBUG] Environment variables loaded.');

// ─── STAGE -1: GLOBAL ENVIRONMENT LOCK ──────────────────────────────────────
// Prevent any service from attempting local Redis connections to stop crash loops
if (process.env.NODE_ENV !== 'production') {
  const redisUrl = process.env.REDIS_URL || '';
  if (redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1') || redisUrl.includes('placeholder')) {
    console.log('🔒 [Global Lock] Redis URL neutralized for localhost stability.');
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
  }
}

// Minimal Express Setup
console.log('[DEBUG] Initializing Sentry...');
const { initSentry } = require('./utils/sentry');
initSentry();
console.log('[DEBUG] Sentry initialized.');

console.log('[DEBUG] Loading Express and FFmpeg...');
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
console.log('[DEBUG] Express and FFmpeg loaded.');

// Configure high-fidelity FFmpeg path
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe';

if (fs.existsSync(FFMPEG_PATH)) {
  console.log(`🚀 [System] Using high-fidelity FFmpeg: ${FFMPEG_PATH}`);
  ffmpeg.setFfmpegPath(FFMPEG_PATH);
  ffmpeg.setFfprobePath(FFPROBE_PATH);
} else {
  // In production (Linux), ffmpeg is usually in the PATH. 
  // fluent-ffmpeg handles this automatically, but we can explicitly log it.
  console.log('ℹ️ [System] High-fidelity FFmpeg path not found, using system default.');
}
const app = express();
const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

// Trust proxy for rate limiting behind Render/Railway
app.set('trust proxy', 1);
app.set('x-powered-by', false);

console.log('[DEBUG] System initialization stage 0 complete. Port:', PORT, 'Host:', HOST);

// ─── STAGE 0.5: IMMEDIATE ROUTE REGISTRATION ───────────────────────────────
// Must be defined BEFORE app.listen() to ensure zero-millisecond availability

// Dev-Mode "Black Hole" Preventer: Intercepts hanging requests immediately in Dev
app.use((req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production' || req.headers.host?.includes('localhost');
  const url = req.url || '';
  // Match both unversioned (/api/content) and versioned (/api/v1/content) paths
  const isTarget = /content|subscription|video/.test(url);
  
  if (isDev && isTarget && req.method === 'GET') {
    const { getDatabaseHealth } = require('./config/database');
    const health = getDatabaseHealth();
    
    if (health.status !== 'connected') {
      console.log(`🛡️ [Stage 0.5 Shield] Blocking hang on ${req.method} ${url} (DB: ${health.status})`);
      return res.json({
        success: true,
        data: [],
        status: 'completed',
        progress: 100,
        simulated: true,
        message: 'Shield active'
      });
    }
  }
  next();
});

// Root health check for Render.com load balancer
app.get('/', (req, res, next) => {
  if (app.get('nextReady')) {
    return next();
  }
  res.status(200).json({ status: 'active', message: 'Nexus Cluster Root Responsive', booting: true });
});

app.get('/api/status/health-pro', (req, res) => {
  res.status(200).json({
    status: 'active',
    stage: 1,
    id: 'click-calibration-node',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    node: process.version
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'active', stage: 1, message: 'Nexus Cluster Port Bound' });
});

app.get('/api/test/timeout', (req, res) => {
  // This should trigger the 35s timeout
  setTimeout(() => {
    if (!res.headersSent) {
      res.json({ message: 'This should not be seen' });
    }
  }, 40000);
});

// ─── STAGE 1: PORT BINDING ──────────────────────────────────────────
// Only bind to port if run directly. For tests, we don't bind.
let server;
if (require.main === module) {
  console.log(`[DEBUG] Attempting to listen on ${HOST}:${PORT}...`);
  server = app.listen(PORT, () => {
    console.log(`🚀 [DEBUG] Server successfully bound to Port ${PORT}`);
  });
  // Node.js default is 2 minutes. We need 15 minutes for large video uploads (1GB).
  server.timeout = 900000; 
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

// Primary logger initialization
const logger = require('./utils/logger');
console.log('[DEBUG] Logger loaded');
logger.info('🚀 Stage 1 completed. Moving to Stage 2 (Asynchronous Engine Load)...');

async function initializeNexusEngine() {
  console.log('[DEBUG] Initializing Nexus Engine (Asynchronous Boot)...');
  try {
    // 1. Load Essential Middleware (Fast)
    logger.info('📦 Loading core middleware...');
    const cors = require('cors');
    const compression = require('compression');
    const rateLimit = require('express-rate-limit');
    const { securityHeaders, customSecurityHeaders } = require('./middleware/securityHeaders');
    const { initializeSocket } = require('./services/socketService');

    // Sentry Initialization
    /*
    const Sentry = require('@sentry/node');
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        integrations: [Sentry.httpIntegration({ tracing: true })],
        tracesSampleRate: 1.0,
      });
    }
    */

    // 2. Register Global Middleware
    const requestTimeout = require('./middleware/timeout');
    // Apply global timeout of 35s, EXCEPT for large upload routes
    app.use((req, res, next) => {
      const fullUrl = req.originalUrl || req.url;
      const isUpload = fullUrl.includes('/video/upload');
      const isAiEdit = fullUrl.includes('/video/ai-editing');
      
      if (isUpload || isAiEdit) {
        // Use 15-minute timeout for large video uploads (1GB) and AI processing
        return requestTimeout(900)(req, res, next);
      }
      return requestTimeout(35)(req, res, next);
    });
    
    app.set('etag', false);
    app.use(compression());
    
    // Serve static files from the uploads directory
    const uploadsPath = path.join(__dirname, '../uploads');
    try {
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
        // Ensure write permissions
        fs.chmodSync(uploadsPath, '777');
      }
      
      // Heartbeat Log for real-time telemetry
      console.log(`🎯 [Ingress] DIRECT DISK WRITE START: ${uploadsPath}`);
    } catch (err) {
      logger.error('❌ Upload directory init failed', { error: err.message });
    }
    app.use('/uploads', express.static(uploadsPath));
    
    app.use(securityHeaders());
    app.use(customSecurityHeaders);

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000', 'http://localhost:3010',
      'https://click-platform.onrender.com'
    ].filter(Boolean);

    app.use(cors({
      origin: (origin, cb) => {
        // In development, allow null origins (from some tools) and local dev ports
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS blocked for: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Auth-Token', 'Accept-Language'],
      maxAge: 86400
    }));

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    logger.debug('✅ Core middleware registered');

    // 3. Register Routes Immediately (Fast)
    logger.debug('🚀 Registering routes...');
    const { apiVersioning } = require('./middleware/apiVersioning');
    app.use('/api', apiVersioning);

    const safeUse = (mountPath, routeFile) => {
      try {
        logger.debug(`  - Loading route: ${routeFile}`);
        const mod = require(routeFile);
        app.use(mountPath, mod);
        logger.debug(`  - Route loaded: ${mountPath}`);
      } catch (err) {
        logger.warn(`⚠️ Failed to load route ${routeFile}: ${err.message}`);
      }
    };

    const routes = [
      ['/api/auth', './routes/auth'],
      ['/api/user', './routes/user'],
      ['/api/dashboard', './routes/dashboard'],
      ['/api/video', './routes/video'],
      ['/api/ai', './routes/ai-content'],
      ['/api/content', './routes/content'],
      ['/api/subscription', './routes/subscription'],
      ['/api/competitive', './routes/competitive-benchmark'],
      ['/api/remix', './routes/remix'],
      ['/api/analytics', './routes/analytics'],
      ['/api/search', './routes/search'],
      ['/api/niche', './routes/niche'],
      ['/api/social', './routes/social'],
      ['/api/scripts', './routes/scripts'],
      ['/api/templates', './routes/templates'],
      ['/api/library', './routes/library'],
      ['/api/notifications', './routes/notifications'],
      ['/api/intelligence', './routes/intelligence'],
      ['/api/billing', './routes/billing'],
      ['/api/onboarding', './routes/onboarding'],
      ['/api/music', './routes/music'],
      ['/api/music', './routes/music-user-uploads'],
      ['/api/health', './routes/health'],
      ['/api/approvals', './routes/approvals'],
      ['/api/jobs', './routes/jobs'],
      ['/api/assets', './routes/assets'],
      ['/api/phase8', './routes/phase8'],
      ['/api/phase9', './routes/phase9'],
      ['/api/phase10_12', './routes/phase10_12'],
      ['/api/phase13_15', './routes/phase13_15'],
      ['/api/phase16_18', './routes/phase16_18'],
      ['/api/agentic', './routes/agentic'],
      ['/api/click', './routes/click'],
      ['/api/status/production-mode', (req, res) => res.json({ status: 'ready', engine: 'Next.js 14' })]
    ];
    routes.forEach(([path, file]) => typeof file === 'string' ? safeUse(path, file) : app.get(path, file));

    // 3.6 Initialize Background Job Workers
    logger.info('🛰️ Activating background job workers...');
    try {
      const { initializeAllWorkers } = require('./workers/index');
      await initializeAllWorkers();
      logger.info('✅ Background job workers activated');
    } catch (workerErr) {
      logger.error('❌ Failed to activate background workers', { error: workerErr.message });
    }
    
    // 3.5 Global Error Handler (Captures 500s)
    app.use((err, req, res, next) => {
      logger.error('💥 [GLOBAL-ERROR] Unhandled exception occurred:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
      
      if (res.headersSent) return next(err);
      
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message,
        code: 'INGRESS_TERMINATED'
      });
    });

    // 4. Background Database Initialization (Non-blocking)
    (async () => {
      try {
        logger.info('🏗️  Database initialization sequence (BG)...');
        const { initDatabases } = require('./config/database');
        await initDatabases();
      } catch (dbErr) {
        logger.error('❌ Background Database Init Failed', { error: dbErr.message });
      }
    })();

    // 5. Next.js & Sockets
    if (process.env.NODE_ENV === 'production') {
      const next = require('next');
      const nextApp = next({ dev: false, dir: path.join(__dirname, '../client') });
      const handle = nextApp.getRequestHandler();
      nextApp.prepare().then(() => {
        app.set('nextReady', true);
        app.all('*', (req, res) => handle(req, res));
      });
    }

    if (server) initializeSocket(server);
    
    logger.info('🚀 Nexus Cluster Stage 2: Responsive [ASYNCHRONOUS ENGINE LOAD]');
  } catch (err) {
    logger.error('❌ Stage 2 Initialization Failed:', { error: err.message, stack: err.stack });
  }
}

// Export app for testing (supports both default and named imports)
app.app = app;
app.server = server;
app.initializeNexusEngine = initializeNexusEngine;
module.exports = app;

process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

// Start the engine
initializeNexusEngine();

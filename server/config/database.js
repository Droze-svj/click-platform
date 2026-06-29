// Database Configuration - Supports both Supabase and MongoDB during migration
const { supabase, prisma, isPrismaConfigured } = require('./supabase');
const mongoose = require('mongoose');

// Database connection status
let databaseStatus = {
  supabase: false,
  mongodb: false,
  prisma: false
};

// True when a MongoDB URI points at a remote/Atlas (i.e. PRODUCTION) host. Used
// by the dev DB-safety guard to refuse connecting a non-production boot to the
// live prod database. Kept pure + exported so it can be unit-tested. Mirrors the
// test-suite guard in tests/setup-env.js / tests/setup.js. The canonical
// implementation now lives in server/utils/dbSafety.js (one source of truth,
// shared with the standalone scripts); re-exported here for back-compat.
const { isRemoteProdUri } = require('../utils/dbSafety');

// Initialize Supabase connection
const initSupabase = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

      // Test via auth (no exec_sql required). exec_sql is only for migrations.
      const { error: authError } = await adminSupabase.auth.getSession();
      if (!authError) {
        databaseStatus.supabase = true;
        
        return true;
      }
      
    } catch (error) { /* intentionally empty */ }
  } else { /* intentionally empty */ }
  return false;
};

// Initialize Prisma connection
const initPrisma = async () => {
  // Check if prisma module is even available first
  if (isPrismaConfigured()) {
    try {
      await prisma.$connect();
      databaseStatus.prisma = true;
      
      return true;
    } catch (error) { /* intentionally empty */ }
  } else if (process.env.DATABASE_URL) {
    // Only warn if they tried to set a URL but config says it's not ready
    
  }
  return false;
};

// Initialize MongoDB connection (legacy)
const initMongoDB = async () => {
  if (mongoose.connection.readyState === 1) {
    databaseStatus.mongodb = true;
    return true;
  }
  const logger = require('../utils/logger');

  const startInMemory = async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    // Optional PERSISTENT local DB for testing: when INMEMORY_DB_PATH is set, the
    // in-memory mongod stores its data files there so they SURVIVE restarts — a real
    // local test DB without installing MongoDB. Still fully isolated; the dev-safety
    // guard above guarantees this path is only ever taken for a non-prod boot.
    let opts;
    const dbPath = (process.env.INMEMORY_DB_PATH || '').trim();
    if (dbPath) {
      const fsMod = require('fs');
      const pathMod = require('path');
      const abs = pathMod.isAbsolute(dbPath) ? dbPath : pathMod.join(process.cwd(), dbPath);
      fsMod.mkdirSync(abs, { recursive: true });
      // doCleanup:false keeps our data on disk when the server stops/restarts.
      opts = { instance: { dbPath: abs, storageEngine: 'wiredTiger' }, cleanup: { doCleanup: false } };
    }
    const mongoServer = await MongoMemoryServer.create(opts);
    await mongoose.connect(mongoServer.getUri());
    databaseStatus.mongodb = true;
    logger.info(dbPath
      ? `✅ Persistent local MongoDB initialized (data persists across restarts; dbPath: ${dbPath}).`
      : '✅ In-Memory MongoDB successfully initialized.');
    // Dev convenience: seed a small categorized demo music catalog so the editor's
    // Music browser/picker isn't empty. ONLY runs here (in-memory) → never a real DB.
    // Opt out with SEED_DEMO_MUSIC=false. Best-effort; never blocks boot.
    if (process.env.SEED_DEMO_MUSIC !== 'false') {
      try { await require('../utils/seedDemoMusic').seedDemoMusic(); } catch (_) { /* non-fatal */ }
    }
    return true;
  };

  try {
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click';

    // ── DEV DB SAFETY GUARD ─────────────────────────────────────────────────
    // A non-production boot must NEVER connect to the remote/Atlas PRODUCTION
    // database. dotenv loads the prod MONGODB_URI from .env, so a bare
    // `node server/index.js` (or `npm run dev`) would otherwise connect straight
    // to live prod data — exactly how the June-19 incident emptied users/contents.
    // Mirror the test-suite guard (tests/setup-env.js): if we are not in
    // production and the URI is a remote Atlas host, refuse it and use an
    // isolated in-memory MongoDB instead. To test against a persistent local DB,
    // point MONGODB_URI at a localhost URI (e.g. mongodb://localhost:27017/click_local).
    if (process.env.NODE_ENV !== 'production' && isRemoteProdUri(mongoUri)) {
      logger.warn('🛡️  DB SAFETY: refusing to connect a non-production boot to a REMOTE/Atlas database (prod-data protection). Using an isolated in-memory MongoDB. Set MONGODB_URI to a localhost URI for a persistent local DB.');
      return await startInMemory();
    }

    try {
      await mongoose.connect(mongoUri, {
        // 2s was too tight for cold Atlas cluster wake-ups — the
        // dev server kept silently falling back to in-memory after
        // every restart, which meant writes evaporated. 8s gives
        // Atlas the runway it actually needs while still failing
        // fast enough that we don't hang the whole boot.
        serverSelectionTimeoutMS: 8000,
      });
      databaseStatus.mongodb = true;
      return true;
    } catch (primaryError) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('⚠️ Local MongoDB connection failed. Falling back to In-Memory DB for development...', { reason: primaryError.message });
        try {
          return await startInMemory();
        } catch (memError) {
          logger.error('❌ In-Memory DB fallback failed.', { error: memError.message });
          return false;
        }
      }
      throw primaryError;
    }
  } catch (error) {
    return false;
  }
};

// Initialize all database connections
const initDatabases = async () => {
  const logger = require('../utils/logger');
  logger.info('🏗️  Starting database initialization sequence...');

  // Helper for timed execution
  const withTimeout = (promise, ms, label) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} TIMEOUT`)), ms);
    });
    return Promise.race([
      promise.then((res) => {
        clearTimeout(timeoutId);
        return res;
      }),
      timeoutPromise
    ]).catch((err) => {
      clearTimeout(timeoutId);
      throw err;
    });
  };

  // Run initializations in parallel to speed up boot
  const results = await Promise.allSettled([
    withTimeout(initSupabase(), 3000, 'Supabase'),
    withTimeout(initPrisma(), 3000, 'Prisma'),
    withTimeout(initMongoDB(), 12000, 'MongoDB') 
  ]);

  results.forEach((res, i) => {
    let label = 'Unknown';
    if (i === 0) label = 'Supabase';
    else if (i === 1) label = 'Prisma';
    else if (i === 2) label = 'MongoDB';

    if (res.status === 'rejected') {
      logger.warn(`⚠️  ${label} initialization failed or timed out: ${res.reason.message}`);
    } else {
      logger.info(`🏗️  ${label} initialized`, { connected: res.value });
    }
  });

  const success = databaseStatus.supabase || databaseStatus.prisma || databaseStatus.mongodb;

  return {
    success,
    supabase: databaseStatus.supabase,
    prisma: databaseStatus.prisma,
    mongodb: databaseStatus.mongodb
  };
};

// Get database client based on what's available
const getDatabaseClient = () => {
  if (databaseStatus.supabase) {
    return { type: 'supabase', client: supabase };
  }
  if (databaseStatus.prisma) {
    return { type: 'prisma', client: prisma };
  }
  if (databaseStatus.mongodb) {
    return { type: 'mongodb', client: mongoose };
  }
  return null;
};

// Health check
const getDatabaseHealth = () => {
  return {
    status: databaseStatus.supabase || databaseStatus.prisma || databaseStatus.mongodb ? 'connected' : 'disconnected',
    supabase: databaseStatus.supabase,
    prisma: databaseStatus.prisma,
    mongodb: databaseStatus.mongodb,
    preferred: databaseStatus.supabase ? 'supabase' : databaseStatus.prisma ? 'prisma' : 'mongodb'
  };
};

module.exports = {
  initDatabases,
  getDatabaseClient,
  getDatabaseHealth,
  isRemoteProdUri,
  supabase,
  prisma,
  mongoose
};



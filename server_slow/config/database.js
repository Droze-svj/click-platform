// Database Configuration - Supports both Supabase and MongoDB during migration
const { supabase, prisma, isPrismaConfigured } = require('./supabase');
const mongoose = require('mongoose');

// Database connection status
let databaseStatus = {
  supabase: false,
  mongodb: false,
  prisma: false
};

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
      
    } catch (error) {
      
    }
  } else {
    
  }
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
    } catch (error) {
      
    }
  } else if (process.env.DATABASE_URL) {
    // Only warn if they tried to set a URL but config says it's not ready
    
  }
  return false;
};

// Initialize MongoDB connection (legacy)
const initMongoDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click';
    
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2000, // Fast fail
      });
      databaseStatus.mongodb = true;
      return true;
    } catch (primaryError) {
      if (process.env.NODE_ENV !== 'production') {
        const logger = require('../utils/logger');
        logger.warn('⚠️ Local MongoDB connection failed. Falling back to In-Memory DB for development...', { reason: primaryError.message });
        
        try {
          const { MongoMemoryServer } = require('mongodb-memory-server');
          const mongoServer = await MongoMemoryServer.create();
          mongoUri = mongoServer.getUri();
          
          await mongoose.connect(mongoUri);
          databaseStatus.mongodb = true;
          logger.info('✅ In-Memory MongoDB successfully initialized.');
          return true;
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
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} TIMEOUT`)), ms))
    ]);
  };

  // Run initializations in parallel to speed up boot
  const results = await Promise.allSettled([
    withTimeout(initSupabase(), 3000, 'Supabase'),
    withTimeout(initPrisma(), 3000, 'Prisma'),
    withTimeout(initMongoDB(), 3000, 'MongoDB') 
  ]);

  results.forEach((res, i) => {
    const labels = ['Supabase', 'Prisma', 'MongoDB'];
    if (res.status === 'rejected') {
      logger.warn(`⚠️  ${labels[i]} initialization failed or timed out: ${res.reason.message}`);
    } else {
      logger.info(`🏗️  ${labels[i]} initialized`, { connected: res.value });
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
  supabase,
  prisma,
  mongoose
};



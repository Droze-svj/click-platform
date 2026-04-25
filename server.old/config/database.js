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
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });
    databaseStatus.mongodb = true;
    
    return true;
  } catch (error) {
    
    return false;
  }
};

// Initialize all database connections
const initDatabases = async () => {
  

  // Supabase (auth, users)
  const supabaseConnected = await initSupabase();

  // Prisma (optional)
  const prismaConnected = await initPrisma();

  // MongoDB – required for Workflow, Team, ScheduledPost, Content (Mongoose models)
  // Always init when MONGODB_URI is set, regardless of Supabase/Prisma
  const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI)?.trim();
  let mongodbConnected = false;
  if (mongoUri) {
    mongodbConnected = await initMongoDB();
  } else if (!supabaseConnected && !prismaConnected) {
    
    mongodbConnected = await initMongoDB();
  }

  const success = supabaseConnected || prismaConnected || mongodbConnected;

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



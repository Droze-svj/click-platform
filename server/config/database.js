// Database Configuration - Supports both Supabase and MongoDB during migration
const { supabase, prisma, isSupabaseConfigured, isPrismaConfigured } = require('./supabase');
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
      // Create admin client with service role key for server-side operations
      const { createClient } = require('@supabase/supabase-js');
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

      // Test Supabase connection with admin client
      // Try a simple query that doesn't rely on schema cache
      const { data, error } = await adminSupabase.rpc('exec_sql', {
        sql: 'SELECT 1 as test'
      });

      if (!error && data) {
        databaseStatus.supabase = true;
        console.log('✅ Supabase connected successfully');
        return true;
      } else {
        console.warn('⚠️ Supabase connection test failed:', error?.message || 'Unknown error');
        // Fallback: try basic auth check
        try {
          const { data: authData, error: authError } = await adminSupabase.auth.getSession();
          if (!authError) {
            databaseStatus.supabase = true;
            console.log('✅ Supabase connected successfully (auth check)');
            return true;
          }
        } catch (authErr) {
          console.warn('⚠️ Supabase auth check also failed');
        }
      }
    } catch (error) {
      console.warn('⚠️ Supabase connection error:', error.message);
    }
  } else {
    console.warn('⚠️ Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  return false;
};

// Initialize Prisma connection
const initPrisma = async () => {
  if (isPrismaConfigured()) {
    try {
      await prisma.$connect();
      databaseStatus.prisma = true;
      console.log('✅ Prisma (PostgreSQL) connected successfully');
      return true;
    } catch (error) {
      console.error('❌ Prisma connection error:', error.message);
    }
  } else {
    console.warn('⚠️ Prisma not configured. Set DATABASE_URL');
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
    });
    databaseStatus.mongodb = true;
    console.log('✅ MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return false;
  }
};

// Initialize all database connections
const initDatabases = async () => {
  console.log('🔄 Initializing database connections...');

  // Try Supabase first (preferred)
  const supabaseConnected = await initSupabase();

  // Try Prisma second
  const prismaConnected = await initPrisma();

  // Fall back to MongoDB
  if (!supabaseConnected && !prismaConnected) {
    console.log('⚠️ No modern database configured, falling back to MongoDB...');
    await initMongoDB();
  }

  return {
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



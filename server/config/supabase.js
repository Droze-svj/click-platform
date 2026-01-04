// Supabase Configuration
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

// Supabase client for real-time features and auth
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase configuration missing. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
}

// Create Supabase client
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Prisma client for complex queries and data management
let prisma;
try {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    // For Prisma 7.x, the connection URL should be set via environment variable
    // The PrismaClient will automatically pick it up from DATABASE_URL
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  } else {
    console.warn('⚠️ DATABASE_URL not set, Prisma client not initialized');
    prisma = null;
  }
} catch (error) {
  console.error('❌ Failed to initialize Prisma client:', error);
  prisma = null;
}

module.exports = {
  supabase,
  prisma,
  isSupabaseConfigured: () => !!(supabaseUrl && supabaseKey),
  isPrismaConfigured: () => !!prisma,
};



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
    // For Prisma 7.x, try different import patterns
    let PrismaClient;
    try {
      // Try the new Prisma 7.x import
      const { PrismaClient: PrismaClient7 } = require('@prisma/client');
      PrismaClient = PrismaClient7;
    } catch (e) {
      console.warn('⚠️ Prisma 7.x import failed, trying legacy import');
      try {
        // Fallback to legacy import
        const { PrismaClient: PrismaClientLegacy } = require('@prisma/client');
        PrismaClient = PrismaClientLegacy;
      } catch (e2) {
        console.warn('⚠️ All Prisma imports failed, disabling Prisma');
        PrismaClient = null;
      }
    }

    if (PrismaClient) {
      prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      });
      console.log('✅ Prisma client initialized');
    } else {
      prisma = null;
    }
  } else {
    console.warn('⚠️ DATABASE_URL not set, Prisma client not initialized');
    prisma = null;
  }
} catch (error) {
  console.error('❌ Failed to initialize Prisma client:', error.message);
  console.log('🔄 Continuing without Prisma - will use Supabase fallback');
  prisma = null;
}

module.exports = {
  supabase,
  prisma,
  isSupabaseConfigured: () => !!(supabaseUrl && supabaseKey),
  isPrismaConfigured: () => !!prisma,
};



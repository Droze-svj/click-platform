// Supabase Configuration
const { createClient } = require('@supabase/supabase-js');
let PrismaClient = null;
try {
  const prismaModule = require('@prisma/client');
  PrismaClient = prismaModule.PrismaClient;
} catch (e) {
  
}

// Supabase client for real-time features and auth
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  
}

// Create Supabase client
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Prisma client initialization
let prisma = null;
if (PrismaClient && process.env.DATABASE_URL) {
  try {
    prisma = new PrismaClient({
      log: ['error'],
    });
  } catch (e) {
    logger.warn('Prisma client failed to initialize', { error: e.message });
  }
}

module.exports = {
  supabase,
  prisma,
  isSupabaseConfigured: () => !!(supabaseUrl && supabaseKey),
  isPrismaConfigured: () => !!prisma,
};



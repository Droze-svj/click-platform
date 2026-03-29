// Supabase Configuration
const { createClient } = require('@supabase/supabase-js');
let PrismaClient = null;
try {
  const prismaModule = require('@prisma/client');
  PrismaClient = prismaModule.PrismaClient;
} catch (e) {
  console.warn('⚠️ @prisma/client failed to load (likely missing generated client).');
}

// Supabase client for real-time features and auth
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase configuration missing. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
}

// Create Supabase client
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Prisma client disabled for production - using Supabase only
let prisma = null;
console.log('🔄 Prisma disabled - using Supabase as primary database');

module.exports = {
  supabase,
  prisma,
  isSupabaseConfigured: () => !!(supabaseUrl && supabaseKey),
  isPrismaConfigured: () => !!prisma,
};



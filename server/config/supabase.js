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

// Prisma client disabled for production - using Supabase only
let prisma = null;


module.exports = {
  supabase,
  prisma,
  isSupabaseConfigured: () => !!(supabaseUrl && supabaseKey),
  isPrismaConfigured: () => !!prisma,
};



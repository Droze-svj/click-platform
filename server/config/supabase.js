// Supabase Configuration
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
let PrismaClient = null;
try {
  const prismaModule = require('@prisma/client');
  PrismaClient = prismaModule.PrismaClient;
} catch (e) {
  // @prisma/client is optional here — Supabase is the primary client. If the
  // Prisma package isn't generated/installed, we simply skip the Prisma path.
}

// Supabase client for backend operations. Uses the SERVICE_ROLE key so the
// auth middleware (and any other server-side caller) can look up users by
// id without being blocked by Row Level Security. This file is required
// only from server-side code — the key never ships to the browser.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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



/**
 * Database Configuration Unit Tests
 */

const { initDatabases, getDatabaseHealth } = require('../../server/config/database');
const mongoose = require('mongoose');
const { supabase, prisma } = require('../../server/config/supabase');

// Mock dependencies
jest.mock('mongoose', () => ({
  connect: jest.fn(),
  connection: {
    readyState: 0,
    close: jest.fn(),
  },
}));

jest.mock('../../server/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
  prisma: {
    $connect: jest.fn(),
  },
  isSupabaseConfigured: jest.fn(),
  isPrismaConfigured: jest.fn(),
}));

// Mock @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    },
  })),
}));

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initDatabases', () => {
    it('should report success if MongoDB connects', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      mongoose.connect.mockResolvedValue(true);

      const result = await initDatabases();

      expect(result.success).toBe(true);
      expect(result.mongodb).toBe(true);
    });

    it('should report success if Supabase connects', async () => {
      const { isSupabaseConfigured } = require('../../server/config/supabase');
      isSupabaseConfigured.mockReturnValue(true);
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      // Mock the auth check in initSupabase
      // Note: initSupabase is internal to database.js, but it uses the imported supabase client or createClient
      
      const result = await initDatabases();

      expect(result.success).toBe(true);
      expect(result.supabase).toBe(true);
    });

    it('should report failure if no databases are configured', async () => {
      process.env.MONGODB_URI = '';
      process.env.SUPABASE_URL = '';
      
      const { isSupabaseConfigured, isPrismaConfigured } = require('../../server/config/supabase');
      isSupabaseConfigured.mockReturnValue(false);
      isPrismaConfigured.mockReturnValue(false);

      const result = await initDatabases();

      // Even if nothing is configured, it falls back to MongoDB init
      // If MongoDB also fails, it should be false
      mongoose.connect.mockRejectedValue(new Error('Conn error'));
      
      const finalResult = await initDatabases();
      expect(finalResult.success).toBe(false);
    });
  });

  describe('getDatabaseHealth', () => {
    it('should return correct health status', async () => {
      // Manually trigger some successes if we could reach internal state,
      // but let's just test the logic after an init call.
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      mongoose.connect.mockResolvedValue(true);

      await initDatabases();
      const health = getDatabaseHealth();

      expect(health.status).toBe('connected');
      expect(health.mongodb).toBe(true);
    });
  });
});

// Setup environment variables before Jest loads any test files
console.log('=== SETUP ENV RUNNING ===');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Force complete isolation from remote Upstash Redis during tests
process.env.REDIS_URL = 'redis://localhost:6379';

// Force Mongoose fallback for auth to keep tests sandboxed
process.env.ENABLE_SUPABASE_AUTH = 'false';

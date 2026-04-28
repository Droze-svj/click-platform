// Test setup file

let MongoMemoryServer;
try {
  ({ MongoMemoryServer } = require('mongodb-memory-server'));
} catch (e) {
  // Silent catch, will handle fallback in beforeAll
}
const mongoose = require('mongoose');

require('dotenv').config({ path: '.env.test' });

let mongoServer;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Mock isomorphic-dompurify before any modules require it
jest.mock('isomorphic-dompurify', () => {
  return {
    sanitize: (dirty, config) => {
      if (typeof dirty !== 'string') {
        return dirty;
      }
      // Basic XSS prevention mock
      return dirty
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    },
    isSupported: true,
    setConfig: () => {},
    clearConfig: () => {},
    addHook: () => {},
    removeHook: () => {},
    removeAllHooks: () => {},
    removeAttribute: () => {},
    addAttribute: () => {},
    removeTag: () => {},
    addTag: () => {},
  };
}, { virtual: false });

// Increase timeout for integration tests
jest.setTimeout(60000);

// Global setup for MongoDB. CI provides MONGODB_URI pointing at a real
// service container — skip the in-memory path there. The
// MongoMemoryServer download from fastdl.mongodb.org 404s for the
// runner's ubuntu version and eats ~60s before failing, by which time
// the test's first insert has already buffer-timed-out.
beforeAll(async () => {
  // readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
  // If a previous test file ran afterAll(close) and we're being reused in
  // the same worker, we need a fresh connect — don't return early.
  if (mongoose.connection.readyState === 1) return;

  let uri = process.env.MONGODB_URI;

  if (!uri) {
    try {
      if (!MongoMemoryServer) throw new Error('mongodb-memory-server module not loaded');
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      process.env.MONGODB_URI = uri;
    } catch (error) {
      console.warn('Failed to start MongoMemoryServer, falling back to local MongoDB:', error.message);
      uri = 'mongodb://localhost:27017/click-test';
    }
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });
});

// Mock external services in tests
jest.mock('../server/services/emailService', () => ({
  sendEmail: jest.fn(() => Promise.resolve({ success: true })),
  sendWelcomeEmail: jest.fn(() => Promise.resolve({ success: true })),
  sendPasswordResetEmail: jest.fn(() => Promise.resolve({ success: true })),
}));

// Suppress console logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Clean up after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

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

// Global setup for MongoDB (preferred in-memory, fallback to local)
beforeAll(async () => {
  let uri;
  try {
    if (!MongoMemoryServer) throw new Error('mongodb-memory-server module not loaded');
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
  } catch (error) {
    console.warn('Failed to start MongoMemoryServer, falling back to local MongoDB:', error.message);
    uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click-test';
  }
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  await mongoose.connect(uri);
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

// Test setup file

require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/click-test';

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
jest.setTimeout(30000);

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
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

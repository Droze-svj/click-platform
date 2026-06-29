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

// Buffer 60s instead of the default 10s. Multi-file integration suites
// close mongoose in their per-file afterAll and the next file's setup
// beforeAll has to reconnect — under CI load the reconnect can take
// longer than 10s, and queued operations buffer-timeout in the meantime.
mongoose.set('bufferTimeoutMS', 60000);

// Global setup for MongoDB. CI provides MONGODB_URI pointing at a real
// service container — skip the in-memory path there. The
// MongoMemoryServer download from fastdl.mongodb.org 404s for the
// runner's ubuntu version and eats ~60s before failing, by which time
// the test's first insert has already buffer-timed-out.
beforeAll(async () => {
  // Fail-closed DB safety check (defense in depth; setup-env.js already pins a
  // safe URI). These suites call UNSCOPED deleteMany() — they must NEVER touch a
  // real/remote database. If anything has pointed us at Atlas, abort the whole
  // run loudly rather than silently wiping production data.
  const activeUri = process.env.MONGODB_URI || '';
  if (/mongodb\+srv:|\.mongodb\.net/i.test(activeUri)) {
    throw new Error(
      `[tests/setup] Refusing to run: MONGODB_URI points at a remote database ` +
      `(${activeUri.replace(/\/\/[^@]*@/, '//***@')}). Tests must use an isolated ` +
      `local/in-memory DB. See tests/setup-env.js.`
    );
  }

  // readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
  if (mongoose.connection.readyState === 1) return;

  let uri = process.env.MONGODB_URI;

  // USE_INMEMORY_DB is set by setup-env.js whenever the configured MONGODB_URI
  // was unsafe/unset (e.g. .env's production Atlas URI). In that case the URI
  // above is only a safe placeholder — ignore it and spin up an isolated
  // in-memory MongoDB so tests never touch a real database.
  const forceInMemory = process.env.USE_INMEMORY_DB === '1';

  if (!uri || forceInMemory) {
    try {
      if (!MongoMemoryServer) throw new Error('mongodb-memory-server module not loaded');
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      process.env.MONGODB_URI = uri;
    } catch (error) {
      console.warn('Failed to start MongoMemoryServer, falling back to local MongoDB:', error.message);
      uri = 'mongodb://localhost:27017/click-test';
    }
  } else {
    // Real (shared) MongoDB — the CI path, where the MongoMemoryServer binary
    // download 404s on the runner so each job points jest at one mongo service.
    // Jest runs suites across PARALLEL workers that all share this single DB, and
    // several route suites call UNSCOPED Content/User.deleteMany({}) in afterEach
    // — so one worker wipes another worker's freshly-saved user mid-request and
    // that request 401s ("user not found"). Give each worker its OWN database
    // (…/click-test-w<id>) on the shared server so parallel suites are isolated,
    // exactly like the per-worker in-memory DBs are locally. No-op single-worker.
    const workerId = process.env.JEST_WORKER_ID;
    if (workerId) {
      uri = uri.replace(/(mongodb(?:\+srv)?:\/\/[^/]+\/)([^/?]+)(\?|$)/i, (_m, head, db, tail) => `${head}${db}-w${workerId}${tail}`);
      process.env.MONGODB_URI = uri;
    }
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });
  // mongoose.connect resolves on initial handshake; readyState should be 1
  // here, but if the connection emits 'disconnected' between connect and
  // the test's first query, queries buffer. Wait for the 'connected' event
  // explicitly to be safe.
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve, reject) => {
      const onConnected = () => { cleanup(); resolve(); };
      const onError = (err) => { cleanup(); reject(err); };
      const cleanup = () => {
        mongoose.connection.off('connected', onConnected);
        mongoose.connection.off('error', onError);
      };
      mongoose.connection.once('connected', onConnected);
      mongoose.connection.once('error', onError);
    });
  }
});

// Mock external services in tests
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockImplementation((name, data, opts) => Promise.resolve({
      id: 'test-job-id',
      name,
      data,
      opts,
      getState: jest.fn().mockResolvedValue('waiting'),
      progress: 0,
    })),
    getJob: jest.fn().mockImplementation((jobId) => {
      if (jobId === 'non-existent') return Promise.resolve(null);
      return Promise.resolve({
        id: jobId,
        name: 'test-job',
        data: { test: 'data' },
        getState: jest.fn().mockResolvedValue('active'),
        progress: 50,
        timestamp: Date.now(),
      });
    }),
    getWaitingCount: jest.fn().mockResolvedValue(1),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(5),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    close: jest.fn().mockResolvedValue(),
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(),
      on: jest.fn(),
    })),
    QueueEvents: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(),
      on: jest.fn(),
    })),
  };
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(),
    disconnect: jest.fn(),
  }));
});

jest.mock('../server/services/emailService', () => ({
  sendEmail: jest.fn(() => Promise.resolve({ success: true })),
  sendWelcomeEmail: jest.fn(() => Promise.resolve({ success: true })),
  sendPasswordResetEmail: jest.fn(() => Promise.resolve({ success: true })),
}));

jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      count: jest.fn().mockResolvedValue(0),
    },
    $disconnect: jest.fn().mockResolvedValue(),
    $connect: jest.fn().mockResolvedValue(),
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
  };
});

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
    mongoServer = null;
    delete process.env.MONGODB_URI;
  }
});

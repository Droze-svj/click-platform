// Jest configuration

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/index.js',
    '!server/config/**',
    '!**/node_modules/**',
    '!server/utils/logger.js',
    '!server/middleware/requestLogger.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  // V8 coverage, NOT the default babel-plugin-istanbul provider.
  //
  // WHY: the security-audit override pins `minimatch: ^10` for every package in
  // the tree, but babel-plugin-istanbul@6 depends on test-exclude@6, which
  // declares `minimatch: ^3.0.4` and calls it as a CALLABLE DEFAULT. minimatch
  // dropped that default export in v7+, so instrumentation threw
  // `TypeError: minimatch is not a function` and EVERY suite failed to run the
  // moment --coverage was passed. That is the real reason coverage collapsed to
  // 0/0 (the old "no --selectProjects" theory in ci.yml was a misdiagnosis).
  // The v8 provider reads coverage straight from the VM, so it never loads
  // test-exclude and the override can keep doing its security job untouched.
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  // Handle ES modules in node_modules (for isomorphic-dompurify)
  transformIgnorePatterns: [
    'node_modules/(?!(isomorphic-dompurify|parse5)/)'
  ],
  // Mock DOMPurify for tests to avoid ES module issues
  moduleNameMapper: {
    '^isomorphic-dompurify$': '<rootDir>/tests/mocks/dompurify.mock.js',
    '^isomorphic-dompurify/(.*)$': '<rootDir>/tests/mocks/dompurify.mock.js'
  },
  // Separate test suites
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/tests/server/**/*.test.js',
        '<rootDir>/tests/services/**/*.test.js'
      ],
      // tests/server/routes/* boot the full app per suite. They were previously
      // ignored (stale assertions + 75-150s/suite against a real DB). Now repaired:
      // fixtures match the current auth/validation/response contracts, and the
      // DB-safety guard in tests/setup-env.js forces an isolated in-memory Mongo,
      // so each suite runs in ~5s and they gate like any other unit test.
      testPathIgnorePatterns: ['/node_modules/'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      // With `projects`, the root-level testTimeout is ignored, so this project
      // fell back to jest's 5s default. tests/server/routes/* boot the app + do a
      // real bcrypt(12) hash on register, which spikes past 5s under parallel CI
      // load → a flaky timeout on auth.test.js. 30s gives ample headroom.
      testTimeout: 30000,
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: 30000,
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/tests/security/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: 30000,
    },
    {
      // Breadth endpoint sweep — hits every safe GET endpoint. Non-gating
      // (not in the `unit` CI gate); run on demand via `npm run smoke:full`.
      displayName: 'smoke-full',
      testMatch: ['<rootDir>/tests/smoke/smokeFull.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    },
    {
      // Render-fidelity — renders known editor states through real ffmpeg and
      // probes the output. Non-gating (needs an ffmpeg binary; auto-skips
      // without one). Run via `npm run test:fidelity`.
      displayName: 'render-fidelity',
      testMatch: ['<rootDir>/tests/render/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: 120000,
    },
  ]
};



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
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
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
      testMatch: ['<rootDir>/tests/server/**/*.test.js'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/tests/security/**/*.test.js'],
    },
  ]
};



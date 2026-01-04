// Playwright E2E Test Configuration (Without WebServer)
// Use this config when server is already running

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.(js|ts)$/, // Allow .spec.js and .spec.ts (debug tests live in TS)
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60 * 1000, // 60 seconds per test
  expect: {
    timeout: 10 * 1000,
    threshold: 0.2,
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        screenshot: 'only-on-failure',
      },
    },
  ],
  // No webServer - assumes server is already running
  // Global setup/teardown
  globalSetup: require.resolve('./tests/e2e/helpers/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/helpers/global-teardown.js'),
});


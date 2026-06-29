// Playwright config for the CI gate smoke (the required `e2e` check).
// Runs ONLY tests/e2e/ci-smoke.spec.js against an already-running server +
// frontend (the e2e workflow starts both, then waits for the ports). Fast and
// deterministic — see tests/e2e/ci-smoke.spec.js for the rationale.

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: /ci-smoke\.spec\.js$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60 * 1000,
  expect: { timeout: 15 * 1000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // No webServer / globalSetup — the e2e workflow owns the server lifecycle and
  // its wait-on step guarantees both ports are live before tests start.
});

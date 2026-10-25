// Playwright config for the user-journey suite (tests/e2e/journeys).
//
// Real end-to-end journeys — sign-up, profile, auth, every dashboard page,
// upload → manual edit → export, AI auto edit, generators, settings, billing —
// run against an ALREADY-RUNNING backend + frontend. The e2e workflow starts
// both (server with NODE_ENV=test so AI is mocked and deterministic, client as
// a production build) and waits for the ports; locally, start your own stack
// and point E2E_BASE_URL / E2E_API_URL at it (see tests/e2e/journeys/README.md).
//
// Serial on purpose (workers: 1): the journeys share one backend, and the video
// pipeline (ffmpeg renders, auto edit) is CPU-bound — parallel workers only make
// the timings noisy.

// Plain config object (no defineConfig/devices import) so the config never
// pins a second copy of @playwright/test next to the one the specs load.
const CI = !!process.env.CI;

module.exports = {
  testDir: './tests/e2e/journeys',
  testMatch: /\.spec\.js$/,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: 1,
  // Per-test budget. The video journeys raise their own (test.setTimeout).
  timeout: 90 * 1000,
  expect: { timeout: 15 * 1000 },
  outputDir: 'test-results/journeys',
  reporter: CI
    ? [['list'], ['html', { outputFolder: 'playwright-report/journeys', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15 * 1000,
    navigationTimeout: 45 * 1000,
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  ],
  // No webServer / globalSetup — whoever runs the suite owns the servers.
};

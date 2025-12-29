# E2E Testing Guide

This directory contains comprehensive End-to-End (E2E) tests for critical user flows using Playwright, including visual regression, accessibility, and performance testing.

## Setup

1. **Install Playwright:**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

2. **Install browsers:**
```bash
npx playwright install chromium firefox webkit
```

## Running Tests

### Run all E2E tests:
```bash
npm run test:e2e:browser
```

### Run tests in UI mode:
```bash
npm run test:e2e:ui
```

### Run tests in debug mode:
```bash
npm run test:e2e:debug
```

### Run specific test file:
```bash
npx playwright test tests/e2e/auth-flow.spec.js
```

### Run specific test suites:
```bash
npm run test:e2e:accessibility
npm run test:e2e:performance
npm run test:e2e:visual
```

### Run tests in specific browser:
```bash
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### Update visual snapshots:
```bash
npm run test:e2e:update-snapshots
```

## Test Structure

### Test Files:
- `auth-flow.spec.js` - Authentication flows (login, register, logout)
- `oauth-flow.spec.js` - OAuth connection flows
- `content-creation-flow.spec.js` - Content creation and management
- `video-processing-flow.spec.js` - Video upload and processing
- `social-posting-flow.spec.js` - Social media posting flows
- `complete-user-journey.spec.js` - Full user journey tests
- `accessibility.spec.js` - Accessibility compliance tests
- `performance.spec.js` - Performance and load time tests
- `visual-regression.spec.js` - Visual regression tests

### Helpers:
- `helpers/test-helpers.js` - Reusable test helper functions
- `helpers/api-mock.js` - API mocking and network interception
- `helpers/accessibility-helpers.js` - Accessibility testing utilities
- `helpers/performance-helpers.js` - Performance measurement utilities
- `helpers/global-setup.js` - Global test setup
- `helpers/global-teardown.js` - Global test cleanup

### Fixtures:
- `fixtures/test-data.js` - Test data generators and templates

## Configuration

E2E tests are configured in `playwright.config.js`:
- Base URL: `http://localhost:3000` (or set `E2E_BASE_URL` env var)
- Browsers: Chromium, Firefox, WebKit
- Screenshots: On failure
- Videos: Retained on failure
- Retries: 2 retries in CI, 0 locally

## Environment Variables

```env
E2E_BASE_URL=http://localhost:3000  # Frontend URL
E2E_API_URL=http://localhost:5001   # Backend API URL
```

## Test Data

Tests use dynamic test data:
- Email: `test-{timestamp}-{random}@example.com`
- Test users are created and cleaned up automatically

## Writing New Tests

1. Create a new test file: `tests/e2e/your-flow.spec.js`
2. Import test helpers:
```javascript
const { test, expect } = require('@playwright/test');
const { login, navigateToSection } = require('./helpers/test-helpers');
```
3. Write test cases:
```javascript
test.describe('Your Flow', () => {
  test('should do something', async ({ page }) => {
    await login(page);
    // Your test steps
  });
});
```

## Best Practices

1. **Use helpers** - Reuse helper functions for common operations
2. **Wait for elements** - Always wait for elements before interacting
3. **Clean up** - Tests should clean up after themselves
4. **Isolated tests** - Each test should be independent
5. **Meaningful assertions** - Verify actual behavior, not just presence

## Debugging

### Run in headed mode:
```bash
npx playwright test --headed
```

### Slow down execution:
```bash
npx playwright test --slow-mo=1000
```

### Debug specific test:
```bash
npx playwright test --debug tests/e2e/auth-flow.spec.js
```

### View trace:
```bash
npx playwright show-trace trace.zip
```

## CI/CD Integration

E2E tests run in CI/CD pipeline:
- Install browsers in CI
- Run tests in headless mode
- Generate reports
- Upload screenshots/videos on failure

## Troubleshooting

### Tests timing out:
- Increase timeout in test: `test.setTimeout(60000)`
- Check if server is running
- Verify base URL is correct

### Elements not found:
- Use `page.waitForSelector()` before interacting
- Check selector is correct
- Verify element is visible (not hidden)

### Flaky tests:
- Add proper waits
- Use `waitForLoadState('networkidle')`
- Avoid hard-coded timeouts when possible


// E2E Test Helpers

const { expect } = require('@playwright/test');
const { generateTestUser, generateTestContent } = require('../fixtures/test-data');

/**
 * Wait for API response
 */
async function waitForAPIResponse(page, urlPattern, timeout = 30000) {
  return page.waitForResponse(
    response => response.url().includes(urlPattern) && response.status() === 200,
    { timeout }
  );
}

/**
 * Login helper
 */
async function login(page, email = 'test@example.com', password = 'password123') {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

/**
 * Register new user
 */
async function register(page, email, password, name) {
  await page.goto('/register');
  await page.fill('input[name="name"]', name);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

/**
 * Wait for content to load
 */
async function waitForContentLoad(page) {
  await page.waitForSelector('[data-testid="content-list"], .content-item, .loading-spinner', {
    state: 'visible',
    timeout: 10000
  });
  // Wait for loading to complete
  await page.waitForSelector('.loading-spinner', { state: 'hidden', timeout: 5000 }).catch(() => {});
}

/**
 * Create test content
 */
async function createContent(page, title, text) {
  await page.goto('/dashboard/content');
  await page.click('button:has-text("Create"), button:has-text("New Content")');
  await page.fill('input[name="title"], textarea[name="title"]', title);
  await page.fill('textarea[name="text"], textarea[name="content"]', text);
  await page.click('button:has-text("Generate"), button:has-text("Create")');
  await waitForContentLoad(page);
}

/**
 * Upload file
 */
async function uploadFile(page, filePath, selector = 'input[type="file"]') {
  const fileInput = await page.locator(selector);
  await fileInput.setInputFiles(filePath);
  // Wait for upload to complete
  await page.waitForSelector('.upload-progress, .upload-complete', {
    state: 'visible',
    timeout: 30000
  }).catch(() => {});
}

/**
 * Wait for toast notification
 */
async function waitForToast(page, message, type = 'success') {
  await page.waitForSelector(`[data-toast="${type}"]`, { timeout: 5000 });
  const toast = page.locator(`[data-toast="${type}"]`);
  if (message) {
    await expect(toast).toContainText(message);
  }
}

/**
 * Navigate to dashboard section
 */
async function navigateToSection(page, section) {
  await page.goto(`/dashboard/${section}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Check if element is visible
 */
async function isVisible(page, selector) {
  try {
    await page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate unique test email
 */
function generateTestEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Create test user with fixtures
 */
function createTestUserData() {
  return generateTestUser();
}

/**
 * Create test content with fixtures
 */
function createTestContentData() {
  return generateTestContent();
}

/**
 * Wait for API call to complete
 */
async function waitForAPICall(page, method, urlPattern) {
  return page.waitForResponse(
    response => {
      return response.request().method() === method.toUpperCase() &&
             response.url().includes(urlPattern);
    },
    { timeout: 30000 }
  );
}

module.exports = {
  waitForAPIResponse,
  login,
  register,
  waitForContentLoad,
  createContent,
  uploadFile,
  waitForToast,
  navigateToSection,
  isVisible,
  generateTestEmail,
  waitForAPICall,
  createTestUserData,
  createTestContentData,
};


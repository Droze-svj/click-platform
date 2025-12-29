// E2E Tests: Authentication Flows

const { test, expect } = require('@playwright/test');
const { login, register, generateTestEmail, waitForToast } = require('./helpers/test-helpers');

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and local storage
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('User Registration Flow', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    const name = 'E2E Test User';

    // Navigate to register page
    await page.goto('/register');

    // Fill registration form
    await page.fill('input[name="name"], input[placeholder*="name" i]', name);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    // Submit form
    await page.click('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');

    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard/, { timeout: 10000 });

    // Verify successful registration
    await expect(page).toHaveURL(/dashboard/);
    
    // Check for success message or user info
    const userInfo = await page.locator('[data-testid="user-name"], .user-name').textContent().catch(() => null);
    if (userInfo) {
      expect(userInfo).toContain(name);
    }
  });

  test('User Login Flow', async ({ page }) => {
    const email = 'test@example.com';
    const password = 'password123';

    // Navigate to login page
    await page.goto('/login');

    // Fill login form
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    // Submit form
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');

    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard/, { timeout: 10000 });

    // Verify successful login
    await expect(page).toHaveURL(/dashboard/);
  });

  test('Login with Invalid Credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await page.waitForSelector('.error, [role="alert"], .toast-error', { timeout: 5000 });
    const errorMessage = await page.locator('.error, [role="alert"], .toast-error').textContent();
    expect(errorMessage).toBeTruthy();
  });

  test('Password Reset Flow', async ({ page }) => {
    await page.goto('/login');

    // Click forgot password link
    const forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("Reset")');
    if (await forgotPasswordLink.count() > 0) {
      await forgotPasswordLink.click();
      
      // Fill email
      await page.fill('input[type="email"]', 'test@example.com');
      await page.click('button:has-text("Send"), button:has-text("Reset")');

      // Should show success message
      await page.waitForSelector('.success, [role="alert"]', { timeout: 5000 });
    }
  });

  test('Session Persistence', async ({ page, context }) => {
    // Login
    await login(page);

    // Get token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be logged in
    await expect(page).toHaveURL(/dashboard/);
  });

  test('Logout Flow', async ({ page }) => {
    // Login first
    await login(page);

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"]');
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      
      // Should redirect to login
      await page.waitForURL(/login/, { timeout: 5000 });
      await expect(page).toHaveURL(/login/);
    }
  });
});




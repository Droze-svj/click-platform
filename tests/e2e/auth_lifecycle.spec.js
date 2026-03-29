const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Auth Lifecycle & Profile Management', () => {
  const testUser = {
    email: `sovereign-${Date.now()}@test.com`,
    password: 'SecurePassword123!',
    name: 'Sovereign Tester'
  };

  test('Full User Journey: Register -> Login -> Profile Update', async ({ page }) => {
    // 1. Registration
    await page.goto(`${BASE_URL}/auth/register`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="name"]', testUser.name);
    
    const registerBtn = page.locator('button:has-text("Register"), button:has-text("Sign Up")');
    await registerBtn.click();

    // Wait for redirect to dashboard or login
    await page.waitForURL(/dashboard|login/);
    
    // 2. Login (if redirected to login)
    if (page.url().includes('/login')) {
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Login")');
      await page.waitForURL(/dashboard/);
    }

    await expect(page).toHaveURL(/dashboard/);

    // 3. Profile Management
    await page.goto(`${BASE_URL}/dashboard/settings/profile`);
    await expect(page.locator('input[name="name"]')).toHaveValue(testUser.name);

    const newName = 'Sovereign Architect 2026';
    await page.fill('input[name="name"]', newName);
    await page.click('button:has-text("Save"), button:has-text("Update")');

    // Verify toast or success message
    await expect(page.locator('text=/success|updated/i')).toBeVisible();
    
    // Refresh and verify
    await page.reload();
    await expect(page.locator('input[name="name"]')).toHaveValue(newName);
  });

  test('Security: Redirect unauthorized users from dashboard', async ({ page }) => {
    // Clear cookies/storage to ensure logged out
    await page.context().clearCookies();
    
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });

  test('Auth: Show error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'WrongPass123!');
    await page.click('button:has-text("Login")');

    await expect(page.locator('text=/invalid|error|failed/i')).toBeVisible();
  });
});

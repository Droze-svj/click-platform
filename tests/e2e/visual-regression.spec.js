// E2E Tests: Visual Regression

const { test, expect } = require('@playwright/test');
const { login, navigateToSection } = require('./helpers/test-helpers');

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard Visual Snapshot', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot and compare
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('Content Page Visual Snapshot', async ({ page }) => {
    await navigateToSection(page, 'content');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('content-page.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('Social Media Page Visual Snapshot', async ({ page }) => {
    await navigateToSection(page, 'social');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('social-page.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('Component Visual Snapshot', async ({ page }) => {
    await navigateToSection(page, 'content');
    
    // Wait for content cards to load
    const contentCard = page.locator('.content-card, .content-item').first();
    if (await contentCard.count() > 0) {
      await expect(contentCard).toHaveScreenshot('content-card.png', {
        maxDiffPixels: 50,
      });
    }
  });

  test('Mobile Viewport Visual Snapshot', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});




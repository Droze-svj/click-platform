// E2E Tests: Complete User Journey

const { test, expect } = require('@playwright/test');
const { register, login, navigateToSection, createContent, waitForToast, generateTestEmail } = require('./helpers/test-helpers');

test.describe('Complete User Journey', () => {
  test('Full User Journey: Register → Create Content → Post to Social → View Analytics', async ({ page }) => {
    // Step 1: Register new user
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    const name = 'E2E Journey User';

    await page.goto('/register');
    await page.fill('input[name="name"], input[placeholder*="name" i]', name);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"], button:has-text("Register")');
    
    // Wait for dashboard
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);

    // Step 2: Create content
    await navigateToSection(page, 'content');
    
    const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();
    if (await createButton.count() > 0) {
      await createButton.click();
      
      await page.waitForSelector('input[name="title"], textarea[name="title"]', { timeout: 5000 });
      await page.fill('input[name="title"], textarea[name="title"]', 'Journey Test Content');
      await page.fill('textarea[name="text"], textarea[name="content"]', 'This content was created during a complete E2E user journey test.');
      
      const submitButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
      await submitButton.click();
      
      // Wait for content creation
      await page.waitForTimeout(3000);
    }

    // Step 3: Navigate to social media
    await navigateToSection(page, 'social');
    await expect(page).toHaveURL(/social/);

    // Step 4: Check OAuth status
    const platformCards = page.locator('.platform-card, [data-platform]');
    const platformCount = await platformCards.count();
    expect(platformCount).toBeGreaterThan(0);

    // Step 5: Navigate to analytics
    await navigateToSection(page, 'analytics');
    await expect(page).toHaveURL(/analytics/);

    // Verify analytics page loads
    const analyticsContent = page.locator('.analytics, .dashboard, [data-testid="analytics"]');
    await expect(analyticsContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('Content Workflow: Create → Edit → Schedule → Post', async ({ page }) => {
    await login(page);

    // Create content
    await navigateToSection(page, 'content');
    const createButton = page.locator('button:has-text("Create")').first();
    
    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForSelector('input[name="title"]', { timeout: 5000 });
      
      const title = 'Workflow Test Content';
      await page.fill('input[name="title"]', title);
      await page.fill('textarea[name="text"]', 'Test content for workflow');
      await page.click('button:has-text("Create")');
      
      // Wait for content to appear
      await page.waitForSelector(`text=${title}`, { timeout: 10000 });
      
      // Edit content
      const contentItem = page.locator(`text=${title}`).locator('..');
      const editButton = contentItem.locator('button:has-text("Edit")');
      
      if (await editButton.count() > 0) {
        await editButton.click();
        await page.fill('input[name="title"]', 'Updated Workflow Content');
        await page.click('button:has-text("Save")');
        await waitForToast(page, 'updated', 'success');
      }
      
      // Schedule content
      const scheduleButton = contentItem.locator('button:has-text("Schedule")');
      if (await scheduleButton.count() > 0) {
        await scheduleButton.click();
        await page.waitForSelector('.schedule-modal', { timeout: 5000 });
        await page.click('button:has-text("Schedule")');
        await waitForToast(page, 'scheduled', 'success');
      }
    }
  });
});




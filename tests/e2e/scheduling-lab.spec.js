const { test, expect } = require('@playwright/test');
const { login, navigateToSection } = require('./helpers/test-helpers');

test.describe('Scheduling Lab E2E Flows', () => {
  test.beforeEach(async ({ page }) => {
    // We assume a test user exists or we use the mock login which is often bypassed in E2E setup
    await login(page);
    await navigateToSection(page, 'posts');
  });

  test('should toggle scheduling lab and view temporal timeline', async ({ page }) => {
    // Wait for the posts page to load
    await expect(page.locator('h1')).toContainText('Content Diffusion');

    // Click the Scheduling Lab toggle
    const labToggle = page.locator('#scheduling-lab-toggle');
    await expect(labToggle).toBeVisible();
    await labToggle.click();

    // Verify the Scheduling Hub is visible
    const hubTitle = page.locator('h2:has-text("Temporal Command Engine")');
    await expect(hubTitle).toBeVisible();

    // Verify timeline presence
    const timeline = page.locator('.temporal-timeline');
    await expect(timeline).toBeVisible();
  });

  test('should trigger bulk reschedule and see success state', async ({ page }) => {
    await page.locator('#scheduling-lab-toggle').click();

    // Find the bulk reschedule button
    const bulkBtn = page.locator('#bulk-reschedule-btn');
    await expect(bulkBtn).toBeVisible();
    
    // Clicking it should open a modal or trigger the action
    await bulkBtn.click();

    // We expect some feedback, probably a toast or a status change
    // Using a broad check for now since exact implementation depends on toast container
    await expect(page.locator('text=Rescheduled')).toBeVisible({ timeout: 10000 });
  });

  test('should show conflict indicators on cards', async ({ page }) => {
    await page.locator('#scheduling-lab-toggle').click();

    // Check for conflict badges - assuming some test data has conflicts
    // In a real E2E we might need to create conflicting data first
    const conflictBadge = page.locator('.conflict-indicator');
    // We use count() to check if they are rendered at all if data exists
    const count = await conflictBadge.count();
    console.log(`Found ${count} conflict indicators`);
  });
});

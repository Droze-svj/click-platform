const { test, expect } = require('@playwright/test');
const { login } = require('./helpers/test-helpers');

test.describe('Modern Video Editor', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/video/edit/test-video-id');
  });

  test('should load the editor workspace', async ({ page }) => {
    // Check for the editor shell
    await expect(page.locator('h2')).toContainText('Editor');
    
    // Check for the video preview
    await expect(page.locator('video, .video-preview')).toBeVisible();
    
    // Check for the timeline
    await expect(page.locator('.timeline-container, [data-testid="timeline"]')).toBeVisible();
  });

  test('should switch between categories', async ({ page }) => {
    // Clicking a category (e.g., Template)
    const templateTab = page.locator('button:has-text("Template")');
    if (await templateTab.count() > 0) {
      await templateTab.click();
      await expect(page.locator('h3')).toContainText('Template');
    }
  });

  test('should toggle the AI Assistant', async ({ page }) => {
    const aiButton = page.locator('button:has-text("AI Assistant"), button:has-text("Assistant")');
    if (await aiButton.count() > 0) {
      await aiButton.click();
      await expect(page.locator('[role="dialog"], .assistant-panel')).toBeVisible();
    }
  });
});

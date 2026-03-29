const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Content Pipeline: One-Click Forge to Neural Broadcaster', () => {
  test.beforeEach(async ({ page }) => {
    // Mock login or use existing session
    // For local tests, assume user is already logged in via globalSetup
  });

  test('Forge Lifecycle: Upload -> Process -> Draft -> Broadcaster', async ({ page }) => {
    // 1. Forge Start
    await page.goto(`${BASE_URL}/dashboard/forge`);
    await expect(page.locator('h1, h2')).toContainText(/Forge|Autonomous/i);

    // 2. Upload Mock
    // In E2E, we might just click the "Sample Assets" or "Quick Start" if available
    const quickStartBtn = page.locator('button:has-text("Quick Start"), button:has-text("Generate")');
    if (await quickStartBtn.isVisible()) {
      await quickStartBtn.click();
    } else {
      // Simulate prompt entry
      await page.fill('textarea[placeholder*="describe" i], [class*="editor"]', 'Create a viral tech overview for Click 2026.');
      await page.keyboard.press('Enter');
    }

    // 3. Processing State
    // Check for progress indicator or AI assistant feedback
    await expect(page.locator('text=/processing|generating|analyzing/i').first()).toBeVisible({ timeout: 30000 });

    // 4. Metadata & AEO Synthesis
    // After processing, verify title and description are generated
    const titleInput = page.locator('input[name="title"], [role="textbox"][aria-label*="title" i]').first();
    await expect(titleInput).not.toBeEmpty({ timeout: 60000 });

    // 5. Save Draft
    await page.click('button:has-text("Save Draft"), [aria-label*="save" i]');
    await expect(page.locator('text=/saved|success/i')).toBeVisible();

    // 6. Neural Broadcaster Verification
    await page.goto(`${BASE_URL}/dashboard/broadcaster`);
    await expect(page.locator('text=/scheduled|draft|ready/i').first()).toBeVisible();
    
    // Verify platforms are selectable
    const platformToggles = page.locator('[role="switch"], [type="checkbox"]');
    await expect(platformToggles.count()).toBeGreaterThan(0);
  });
});

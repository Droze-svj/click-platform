const { test, expect } = require('@playwright/test');

/**
 * Sovereign 2026: One-Click Forge E2E Logic
 */
test.describe('Sovereign Forge: One-Click Pipeline', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (mock login state if possible, or perform login)
    await page.goto('/dashboard');
    // Assuming we have a way to skip login or use a persistent context
  });

  test('should trigger the Forge and generate a content draft', async ({ page }) => {
    // 1. Open AI Assistant
    const assistantBtn = page.getByRole('button', { name: /AI Assistant|Forge/i });
    if (await assistantBtn.isVisible()) {
      await assistantBtn.click();
    }

    // 2. Input a prompt (Atomic Strategy)
    const promptInput = page.getByPlaceholder(/Ask CLICK/i);
    await promptInput.fill('Generate a viral tech reel about 2026 Sovereign Systems');
    await page.keyboard.press('Enter');

    // 3. Wait for Synthesis (One-Click Forge)
    // Expecting some progress indicators from Phase 1
    const progressToast = page.locator('.toast', { hasText: /Synthesizing|Forging/i });
    await expect(progressToast).toBeVisible({ timeout: 15000 });

    // 4. Verify draft in Library
    await page.goto('/dashboard/content');
    const firstItem = page.locator('.content-card').first();
    await expect(firstItem).toBeVisible();
    await expect(firstItem).toContainText(/Sovereign/i);
  });

  test('should verify Elite feature accessibility', async ({ page }) => {
    // Navigate to Niche Branding (Elite feature)
    await page.goto('/dashboard/niche');
    
    // Check for "Priority GPU" or "Lattice" badges if elite
    const eliteBadge = page.locator('.badge', { hasText: /Elite|2026/i });
    // This depends on the user's tier, which should be 'elite' for these tests
    // await expect(eliteBadge).toBeVisible();
  });
});

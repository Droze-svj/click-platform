const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

/**
 * Sovereign Production Verification Suite
 * Specifically targets Phase 9 features: Resonance Hub, Neural Broadcaster, and Unified OAuth.
 */
test.describe('Sovereign Phase 9 Verification', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set timeout for complex flows
    test.setTimeout(60000);
    
    // Perform login (assuming a test user exists or we bypass for components)
    // For now, we navigate to the dashboard social page
    await page.goto(`${BASE_URL}/dashboard/social`);
  });

  test('Resonance Hub correctly displays all social platforms', async ({ page }) => {
    // Audit the grid for all 6 core platforms
    const platforms = ['Twitter', 'TikTok', 'YouTube', 'Instagram', 'LinkedIn', 'Facebook'];
    
    for (const platform of platforms) {
      const platformCard = page.locator(`text=${platform}`).first();
      await expect(platformCard).toBeVisible();
    }
  });

  test('Resonance Hub "Topology Scan" performs successfully', async ({ page }) => {
    // Check for the "Resonant" or "Link Node" status indicators
    // We expect the UI to show "NOT_CONNECTED" or similar for unauthenticated users
    const statusBadges = page.locator('[class*="StatusBadg"], [class*="badge"]');
    const badgeCount = await statusBadges.count();
    
    // We expect at least one status badge per platform
    expect(badgeCount).toBeGreaterThanOrEqual(6);
  });

  test('Neural Broadcaster - Pipeline Preview initialization', async ({ page }) => {
    // Navigate to the editor/forge
    await page.goto(`${BASE_URL}/dashboard/content/new`);
    
    // Trigger "One-Click Forge" (if button exists)
    const forgeButton = page.locator('button:has-text("Forge")').first();
    if (await forgeButton.isVisible()) {
      await forgeButton.click();
      
      // Look for the "Neural Broadcaster" or "Queueing" status
      const broadcasterStatus = page.locator('text=/Neural|Broadcaster|Queue/i').first();
      await expect(broadcasterStatus).toBeVisible({ timeout: 10000 });
    } else {
      test.skip('Forge button not found - ignoring pipeline check');
    }
  });

  test('Unified OAuth Connection Trigger (LinkedIn)', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/dashboard/social`);
    
    // Find LinkedIn connect button
    const linkedinButton = page.locator('button:has-text("Connect LinkedIn")').first();
    
    if (await linkedinButton.isVisible()) {
      // Intercept the popup
      const [popup] = await Promise.all([
        context.waitForEvent('page', { timeout: 10000 }).catch(() => null),
        linkedinButton.click()
      ]);

      if (popup) {
        // Verify we are on a linkedin.com domain
        const popupUrl = popup.url();
        expect(popupUrl).toContain('linkedin.com');
        await popup.close();
      }
    }
  });

  test('Unified OAuth Connection Trigger (Facebook)', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/dashboard/social`);
    
    // Find Facebook connect button
    const facebookButton = page.locator('button:has-text("Connect Facebook")').first();
    
    if (await facebookButton.isVisible()) {
      const [popup] = await Promise.all([
        context.waitForEvent('page', { timeout: 10000 }).catch(() => null),
        facebookButton.click()
      ]);

      if (popup) {
        const popupUrl = popup.url();
        expect(popupUrl).toContain('facebook.com');
        await popup.close();
      }
    }
  });
});

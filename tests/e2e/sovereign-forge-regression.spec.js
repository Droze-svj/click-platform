const { test, expect } = require('@playwright/test');
const { login } = require('./helpers/test-helpers');

/**
 * E2E Regression: Sovereign Forge Flow
 * Validates that all hardened views render and function correctly
 * without runtime errors (no more "Shield is not defined").
 */

test.describe('Sovereign Forge Regression', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the platform to establish domain context
    await page.goto('/dashboard/video', { timeout: 60000 });
    
    // Inject dev token into localStorage to bypass authentication
    await page.evaluate(() => {
      localStorage.setItem('token', 'dev-jwt-token-admin');
    });
    
    // Refresh to apply token or navigate to editor
    // The backend mock handlers for video/edit usually handle 'dev-video-123'
    await page.goto('/dashboard/video/edit/dev-video-123', { timeout: 90000, waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
  });

  test('Auto Creator Flow (One-Click Forge)', async ({ page }) => {
    // Select Auto Creator from sidebar
    await page.locator('button:has-text("Auto Creator"), [data-testid="autonomous-creator"]').first().click();
    
    // Verify Auto Creator view rendered
    await expect(page.locator('h2:has-text("One-Click Forge")')).toBeVisible();
    
    // Fill Prompt
    const prompt = 'DESIGN_A_VIRAL_2026_CAMPAIGN_FOR_NEURAL_INTERFACE_WEARABLES_IN_TOKYO';
    await page.locator('textarea[placeholder*="creative vision"]').fill(prompt);
    
    // Select Platform (e.g. YouTube Shorts)
    await page.locator('button:has-text("youtube shorts")').click();
    
    // Click Initialize Manifest
    await page.locator('button:has-text("Initialise Manifest")').click();
    
    // Verify Sequence Stages appear
    await expect(page.locator('text=Neural_Uplink_Trace')).toBeVisible();
    await expect(page.locator('text=Intelligence Gathering')).toBeVisible();
    
    // Wait for synthesis completion (Mocked delay is ~5-7 seconds)
    await expect(page.locator('h3:has-text("Pattern Synthesized")')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=MANIFEST_STABLE')).toBeVisible();
  });

  test('AI Scripts View Persistence', async ({ page }) => {
    // Select AI Scripts from sidebar
    await page.locator('button:has-text("AI Scripts"), [data-testid="scripts"]').first().click();
    
    // Verify view rendered
    await expect(page.locator('h2:has-text("AI Script Generator")')).toBeVisible();
    
    // Test input validation (Topics should be required)
    await page.locator('button:has-text("Initialise script")').click();
    
    // Should show error for missing topic (client-side or server-side)
    const errorToast = page.locator('[data-toast="warning"], [data-toast="error"]');
    await expect(errorToast).toBeVisible();
  });

  test('Growth Insights Analysis', async ({ page }) => {
    // Select Growth from sidebar
    await page.locator('button:has-text("Growth"), [data-testid="growth"]').first().click();
    
    // Verify view rendered
    await expect(page.locator('h4:has-text("Neural Competitor Analysis")')).toBeVisible();
    
    // Switch platforms
    await page.locator('button:has-text("instagram")').click();
    
    // Verify Engagement Standing card is visible
    await expect(page.locator('h3:has-text("Engagement Standing")')).toBeVisible();
  });

  test('AI Analysis & Smart Assist', async ({ page }) => {
    // Select AI Analysis from sidebar
    await page.locator('button:has-text("AI Analysis"), [data-testid="ai-analysis"]').first().click();
    
    // Verify view rendered
    await expect(page.locator('h2:has-text("AESTHETIC_SYNC_DYNAMICS")')).toBeVisible();
    
    // Verify Smart Analysis button is present
    await expect(page.locator('button:has-text("SMART_ANALYSIS_SCAN")')).toBeVisible();
  });

  test('Elite AI -> Variant Factory', async ({ page }) => {
    // Select Elite AI from sidebar
    await page.locator('button:has-text("Elite AI"), [data-testid="ai-edit"]').first().click();
    
    // Click "Variant Factory" sub-nav (if present on view switch)
    const variantTab = page.locator('button:has-text("Variant Factory")');
    if (await variantTab.isVisible()) {
      await variantTab.click();
      await expect(page.locator('h2:has-text("Kinetic Variant Factory")')).toBeVisible();
    }
  });

});

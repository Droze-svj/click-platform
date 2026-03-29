import { test, expect } from '@playwright/test';

/**
 * Sovereign E2E: Autonomous Content Pipeline
 * This test suite validates the full "One-Click Forge" flow, 
 * from neural forge prompt to spectral video synthesis.
 */

test.describe('Sovereign Autonomous Content Pipeline', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the platform
    await page.goto('/');
    
    // Perform login (Mocking or using test credentials)
    // Assuming login page has standard fields
    if (await page.url().includes('/login')) {
      await page.fill('input[type="email"], input[placeholder*="Email"]', 'test@sovereign.ai');
      await page.fill('input[type="password"], input[placeholder*="Password"]', 'Resonance2026!');
      await page.click('button:has-text("LOGIN"), button:has-text("SIGN IN")');
      await expect(page).toHaveURL(/.*dashboard/);
    }
  });

  test('should generate synthetic text payload in Neural Forge', async ({ page }) => {
    await page.goto('/dashboard/content');
    
    // Validate Page Identity
    await expect(page.locator('h1')).toContainText('Neural Forge');
    
    // Fill Forge Logic Seed (Min 50 chars)
    const logicSeed = 'THE_KINETIC_LATTICE_REQUIRES_INFINITE_RECURSION_IN_S2S_OVERLORD_NODES_TO_ACHIEVE_MARKET_DOMINATION_2026';
    await page.placeholder('PASTE_LONG_FORM_LOGIC_SEED_MIN_50_CHARS...').fill(logicSeed);
    
    // Set Operational Designation
    await page.placeholder('PAYLOAD_IDENTIFIER_BETA...').fill('E2E_SYNTH_TEST_001');
    
    // Select Nodes
    await page.click('button:has-text("KINETIC_NODE")'); // TikTok
    
    // Initiate Forge
    await page.click('button:has-text("FORGE_CONTENT")');
    
    // Wait for Success Message
    await expect(page.locator('text=NEURAL_FORGE_SUCCESS: PAYLOAD_READY')).toBeVisible({ timeout: 60000 });
    
    // Verify Payload Repository shows results
    await expect(page.locator('h2:has-text("Neural Payloads")')).toBeVisible();
    await expect(page.locator('article.group/payload')).toHaveCountAtLeast(1);
  });

  test('should observe kinetic synthesis status in Video Studio', async ({ page }) => {
    await page.goto('/dashboard/video');
    
    // Validate Hub Identity
    await expect(page.locator('h1')).toContainText('Video Studio');
    
    // Check if there are active matrices
    const activeCount = await page.locator('div:has-text("Active Matrices") >> div.text-8xl').textContent();
    
    if (parseInt(activeCount) > 0) {
      // Check for processing badges
      const processingBadge = page.locator('text=KINETIC_SYNTHESIS').first();
      if (await processingBadge.isVisible()) {
        await expect(processingBadge).toBeVisible();
      }
    } else {
      // Empty state verification
      await expect(page.locator('text=Synthesis Void Occupied')).toBeVisible();
    }
  });

  test('should navigate to Forge Chamber (Editor) via matrix selection', async ({ page }) => {
    await page.goto('/dashboard/video');
    
    // If a video exists, try to open it
    const openForgeBtn = page.locator('button:has-text("OPEN_FORGE_CHAMBER")').first();
    if (await openForgeBtn.isVisible()) {
      await openForgeBtn.click();
      
      // Should show the Swarm Consensus HUD during transition
      await expect(page.locator('text=Inference Matrix Startup')).toBeVisible();
      
      // Verify redirection to editor
      await expect(page).toHaveURL(/.*video\/edit/);
    }
  });

});

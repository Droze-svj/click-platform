const { test, expect } = require('@playwright/test');

test.describe('Sovereign Master Pipeline E2E', () => {
  test('should execute full content-to-fleet flow', async ({ page }) => {
    // 1. Auth
    await page.goto('/dashboard/overlord');
    // Note: In real E2E we'd login, but here we assume the dashboard is accessible via setup
    
    // 2. Verify Overlord Terminal v1.1 Status
    const terminalVersion = page.locator('text=Overlord Terminal v1.1');
    await expect(terminalVersion).toBeVisible();
    
    // 3. Check Integrity Node [Database]
    const dbStatus = page.locator('text=Database Node').locator('..').locator('p.text-lg');
    await expect(dbStatus).toContainText(/CONNECTED|ONLINE/i);
    
    // 4. Trigger Global Network Verification
    const verifyBtn = page.locator('button:has-text("Run Global Verification")');
    await verifyBtn.click();
    
    // 5. Wait for Verification Cycle
    await expect(page.locator('text=Verifying Network...')).toBeVisible();
    await expect(page.locator('text=Network Verification Cycle Complete'), { timeout: 30000 }).toBeVisible();
    
    // 6. Navigate to Global Network (Phase 9)
    await page.locator('a:has-text("Global Network")').click();
    await expect(page.url()).toContain('/dashboard/phase9');
    
    // 7. Verify Swarm Intelligence Pulse
    const pulseStrength = page.locator('text=Swarm Strength');
    await expect(pulseStrength).toBeVisible();
    
    console.log('✅ Master Pipeline Flow Verified');
  });
});

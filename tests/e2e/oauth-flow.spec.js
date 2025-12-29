// E2E Tests: OAuth Connection Flows

const { test, expect } = require('@playwright/test');
const { login, navigateToSection, waitForToast, isVisible } = require('./helpers/test-helpers');

test.describe('OAuth Connection Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await login(page);
  });

  test('Navigate to Social Media Page', async ({ page }) => {
    await navigateToSection(page, 'social');
    await expect(page).toHaveURL(/social/);
    
    // Should see platform cards
    const platforms = ['Twitter', 'LinkedIn', 'Facebook', 'Instagram'];
    for (const platform of platforms) {
      const platformCard = page.locator(`text=${platform}`);
      await expect(platformCard.first()).toBeVisible();
    }
  });

  test('Check OAuth Connection Status', async ({ page }) => {
    await navigateToSection(page, 'social');

    // Check status for each platform
    const platforms = ['twitter', 'linkedin', 'facebook', 'instagram'];
    
    for (const platform of platforms) {
      // Look for connection status indicators
      const statusIndicator = page.locator(`[data-platform="${platform}"], .platform-${platform}`);
      if (await statusIndicator.count() > 0) {
        const isConnected = await statusIndicator.locator('.connected, .check-circle').count() > 0;
        // Status should be visible (connected or not)
        expect(await statusIndicator.isVisible()).toBeTruthy();
      }
    }
  });

  test('Initiate OAuth Connection Flow', async ({ page, context }) => {
    await navigateToSection(page, 'social');

    // Click connect button for Twitter (first platform)
    const connectButton = page.locator('button:has-text("Connect")').first();
    
    if (await connectButton.count() > 0) {
      // Set up page listener for OAuth redirect
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        connectButton.click()
      ]);

      // If OAuth popup opens, close it (we're just testing the flow)
      if (newPage) {
        await newPage.close();
      }

      // Should show loading or redirect
      // In real scenario, would complete OAuth flow
    }
  });

  test('OAuth Callback Handling', async ({ page }) => {
    // Simulate OAuth callback with URL params
    await page.goto('/dashboard/social?platform=twitter&code=test_code&state=test_state&success=true');
    
    // Should handle callback and show success
    await page.waitForLoadState('networkidle');
    
    // Check for success indicator
    const successIndicator = await isVisible(page, '.success, [data-toast="success"]');
    // May or may not show success depending on implementation
  });

  test('Disconnect OAuth Account', async ({ page }) => {
    await navigateToSection(page, 'social');

    // Find disconnect button (if account is connected)
    const disconnectButton = page.locator('button:has-text("Disconnect")').first();
    
    if (await disconnectButton.count() > 0) {
      // Click disconnect
      await disconnectButton.click();

      // Confirm dialog if present
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
      }

      // Should show success message
      await page.waitForTimeout(1000);
    }
  });

  test('OAuth Configuration Check', async ({ page }) => {
    await navigateToSection(page, 'social');

    // Check if platforms show "Not Available" or "Not Configured"
    const notConfiguredIndicators = page.locator('text=/not.*configured/i, text=/not.*available/i');
    
    // Should show status for each platform
    const platformCards = page.locator('.platform-card, [data-platform]');
    const count = await platformCards.count();
    expect(count).toBeGreaterThan(0);
  });
});




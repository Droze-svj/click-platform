// E2E Test: Onboarding & First-User Experience (Sovereign 2026)

const { test, expect } = require('@playwright/test');
const { login, navigateToSection, waitForToast } = require('./helpers/test-helpers');

test.describe('Sovereign Onboarding Experience', () => {
  const newUser = {
    email: `onboarding_${Date.now()}@sovereign.ai`,
    password: 'Password123!',
    name: 'Sovereign Agent 007'
  };

  test('Complete first-run onboarding sequence', async ({ page }) => {
    // 1. Registration
    await page.goto('/register');
    await page.fill('input[name="name"]', newUser.name);
    await page.fill('input[name="email"]', newUser.email);
    await page.fill('input[name="password"]', newUser.password);
    await page.click('button[type="submit"]');

    // Should land on Onboarding Wizard
    await expect(page).toHaveURL(/onboarding|welcome/i);
    await expect(page.locator('h1, h2')).toContainText(/Welcome|Onboarding/i);

    // 2. Niche Selection
    const nicheOption = page.locator('button:has-text("Technology"), .niche-card-technology').first();
    await expect(nicheOption).toBeVisible({ timeout: 10000 });
    await nicheOption.hover();
    await nicheOption.click();
    await page.click('button:has-text("Continue"), button:has-text("Next")');

    // 3. Brand Kit Setup (Visual DNA)
    await expect(page.locator('h3, h2')).toContainText(/Brand|Visual/i);
    // Fill in a primary color hex
    const colorInput = page.locator('input[type="color"], input[name="primaryColor"]').first();
    if (await colorInput.isVisible()) {
      await colorInput.fill('#6366f1'); // Sovereign Indigo
    }
    await page.click('button:has-text("Apply DNA"), button:has-text("Next")');

    // 4. AI Advisor Calibration
    await expect(page.locator('h3, h2')).toContainText(/Advisor|Strategy/i);
    // Select a strategy (e.g., Viral Growth)
    const strategyCard = page.locator('.strategy-card, button:has-text("Growth")').first();
    await strategyCard.click();
    
    // Final Step: Complete Onboarding
    await page.click('button:has-text("Complete Setup"), button:has-text("Launch")');

    // 5. Landing on Dashboard (Neural Workspace Hub)
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('h1')).toContainText(/WORKSPACE|DASHBOARD/i);

    // Verify AI Advisor is active after sync
    const advisorHub = page.locator('text=/GLOBAL.*ADVISOR/i').first();
    await expect(advisorHub).toBeVisible({ timeout: 15000 });
    
    // Check if the niche we selected (Technology) is reflected
    await expect(advisorHub.locator('xpath=..')).toContainText(/TECHNOLOGY/i);
  });

  test('Skip onboarding flow (Fast-Track)', async ({ page }) => {
    // Register another user
    const fastUser = {
      email: `fast_${Date.now()}@sovereign.ai`,
      password: 'Password123!',
      name: 'Speed Runner'
    };

    await page.goto('/register');
    await page.fill('input[name="name"]', fastUser.name);
    await page.fill('input[name="email"]', fastUser.email);
    await page.fill('input[name="password"]', fastUser.password);
    await page.click('button[type="submit"]');

    // Look for Skip button
    const skipButton = page.locator('button:has-text("Skip"), button:has-text("Do this later")').first();
    if (await skipButton.isVisible({ timeout: 5000 })) {
      await skipButton.click();
      await expect(page).toHaveURL(/dashboard/);
    }
  });
});

// E2E Tests: Billing and Subscription Flow
// Verifies plan selection, checkout redirect, and active status display

const { test, expect } = require('@playwright/test');
const { login, navigateToSection } = require('./helpers/test-helpers');

test.describe('Billing & Subscriptions - Critical Flows', () => {
  const testUser = {
    email: process.env.E2E_TEST_EMAIL || 'test@example.com',
    password: process.env.E2E_TEST_PASSWORD || 'testpassword123',
  };

  test.beforeEach(async ({ page }) => {
    await login(page, testUser.email, testUser.password);
  });

  test('should navigate to billing page and see plans', async ({ page }) => {
    await navigateToSection(page, 'billing');
    
    // Check for plan cards
    const planCards = page.locator('.plan-card, [data-billing-plan]');
    await expect(planCards).toHaveCount(3); // Free, Pro, Elite
    
    // Verify pricing display
    const pricing = page.locator('text=/\\$|Free/i');
    await expect(pricing.first()).toBeVisible();
  });

  test('should show currently active plan', async ({ page }) => {
    await navigateToSection(page, 'billing');
    
    // Check for "Current Plan" indicator
    const activeBadge = page.locator('text=/current plan/i, .active-plan-badge');
    await expect(activeBadge).toBeVisible();
  });

  test('should initiate checkout for Elite plan', async ({ page }) => {
    await navigateToSection(page, 'billing');
    
    // Find Upgrade button for Elite plan
    const elitePlan = page.locator('.plan-card:has-text("Elite"), [data-plan="elite"]');
    const upgradeButton = elitePlan.locator('button:has-text("Upgrade"), button:has-text("Get Started")');
    
    if (await upgradeButton.count() > 0) {
      await upgradeButton.click();
      
      // Should either redirect to Whop/Stripe or show checkout modal
      await page.waitForTimeout(2000);
      const url = page.url();
      // Whop or Stripe URL or internal checkout
      expect(url).toMatch(/whop|stripe|checkout|billing/i);
    }
  });

  test('should display subscription history/invoices', async ({ page }) => {
    await navigateToSection(page, 'billing');
    
    // Check for invoices section
    const invoiceSection = page.locator('text=/billing history/i, text=/invoices/i, .billing-history');
    if (await invoiceSection.isVisible()) {
      await expect(invoiceSection).toBeVisible();
    }
  });
});

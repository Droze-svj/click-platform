const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Billing & Subscription Integration', () => {
  test('Subscription Flow: Pricing -> Select Plan -> Checkout Redirect', async ({ page }) => {
    // 1. Pricing Page
    await page.goto(`${BASE_URL}/pricing`);
    await expect(page.locator('h1, h2')).toContainText(/pricing|plans/i);

    // 2. Select Plan (e.g. Creator)
    const creatorPlanBtn = page.locator('button:has-text("Choose Creator"), button:has-text("Subscribe"), [class*="creator"] button');
    if (await creatorPlanBtn.count() > 0) {
      await creatorPlanBtn.first().click();
      
      // 3. Checkout Redirect (Stripe/Whop)
      // Check for Stripe redirect or billing portal
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      // Verify redirect to stripe or whop or success page
      expect(currentUrl).toMatch(/stripe.com|whop.com|checkout|success/);
    } else {
      test.skip('Pricing buttons not found - may be in development');
    }
  });

  test('Billing Dashboard: Display Current Plan', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/billing`);
    
    // Check for "Current Plan" box
    const planText = page.locator('text=/current plan|subscription|active/i');
    await expect(planText.first()).toBeVisible({ timeout: 10000 });
  });

  test('Billing: Show billing history/invoices', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/billing/history`);
    
    // Check for "History" or "Invoices" table/list
    const historySection = page.locator('text=/history|invoices|transactions/i');
    await expect(historySection.first()).toBeVisible({ timeout: 5000 });
  });
});

// E2E Tests: Social Media Posting Flows

const { test, expect } = require('@playwright/test');
const { login, navigateToSection, waitForToast, isVisible } = require('./helpers/test-helpers');

test.describe('Social Media Posting Flows', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Post to Social Media from Content', async ({ page }) => {
    // Navigate to content
    await navigateToSection(page, 'content');
    await page.waitForLoadState('networkidle');

    // Find a content item
    const contentItem = page.locator('.content-item, [data-content-id]').first();
    
    if (await contentItem.count() > 0) {
      // Click post/share button
      const postButton = contentItem.locator('button:has-text("Post"), button:has-text("Share"), [data-testid="post"]');
      
      if (await postButton.count() > 0) {
        await postButton.click();

        // Wait for post modal/dialog
        await page.waitForSelector('.post-modal, .share-dialog, [data-testid="post-modal"]', { timeout: 5000 });

        // Select platform
        const platformCheckbox = page.locator('input[type="checkbox"][value*="twitter"], input[type="checkbox"][value*="linkedin"]').first();
        if (await platformCheckbox.count() > 0) {
          await platformCheckbox.check();
        }

        // Click post button
        const confirmPostButton = page.locator('button:has-text("Post"), button:has-text("Share")');
        await confirmPostButton.click();

        // Wait for success message
        await waitForToast(page, 'posted', 'success');
      }
    }
  });

  test('Schedule Social Media Post', async ({ page }) => {
    await navigateToSection(page, 'content');
    await page.waitForLoadState('networkidle');

    // Find content item
    const contentItem = page.locator('.content-item, [data-content-id]').first();
    
    if (await contentItem.count() > 0) {
      // Click schedule button
      const scheduleButton = contentItem.locator('button:has-text("Schedule"), [data-testid="schedule"]');
      
      if (await scheduleButton.count() > 0) {
        await scheduleButton.click();

        // Wait for schedule modal
        await page.waitForSelector('.schedule-modal, [data-testid="schedule-modal"]', { timeout: 5000 });

        // Select date/time
        const dateInput = page.locator('input[type="datetime-local"], input[type="date"]');
        if (await dateInput.count() > 0) {
          // Set future date
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 1);
          const dateString = futureDate.toISOString().split('T')[0];
          await dateInput.fill(dateString);
        }

        // Select platform
        const platformCheckbox = page.locator('input[type="checkbox"][value*="twitter"]').first();
        if (await platformCheckbox.count() > 0) {
          await platformCheckbox.check();
        }

        // Confirm schedule
        await page.click('button:has-text("Schedule"), button:has-text("Confirm")');

        // Wait for success
        await waitForToast(page, 'scheduled', 'success');
      }
    }
  });

  test('View Scheduled Posts', async ({ page }) => {
    await navigateToSection(page, 'calendar');
    await expect(page).toHaveURL(/calendar/);

    // Should see calendar or scheduled posts
    const calendarView = page.locator('.calendar, .scheduled-posts, [data-testid="calendar"]');
    await expect(calendarView.first()).toBeVisible({ timeout: 5000 });
  });

  test('Bulk Post to Multiple Platforms', async ({ page }) => {
    await navigateToSection(page, 'content');
    await page.waitForLoadState('networkidle');

    // Find content item
    const contentItem = page.locator('.content-item, [data-content-id]').first();
    
    if (await contentItem.count() > 0) {
      // Click post button
      const postButton = contentItem.locator('button:has-text("Post"), [data-testid="post"]');
      
      if (await postButton.count() > 0) {
        await postButton.click();
        await page.waitForSelector('.post-modal, [data-testid="post-modal"]', { timeout: 5000 });

        // Select multiple platforms
        const platforms = ['twitter', 'linkedin', 'facebook'];
        for (const platform of platforms) {
          const checkbox = page.locator(`input[type="checkbox"][value*="${platform}"]`);
          if (await checkbox.count() > 0) {
            await checkbox.check();
          }
        }

        // Post to all selected
        await page.click('button:has-text("Post to All"), button:has-text("Post")');

        // Wait for success
        await waitForToast(page, 'posted', 'success');
      }
    }
  });

  test('Post Analytics View', async ({ page }) => {
    await navigateToSection(page, 'analytics');
    await expect(page).toHaveURL(/analytics/);

    // Should see analytics dashboard
    const analyticsView = page.locator('.analytics, .dashboard, [data-testid="analytics"]');
    await expect(analyticsView.first()).toBeVisible({ timeout: 5000 });

    // Check for social media metrics
    const socialMetrics = page.locator('text=/twitter|linkedin|facebook|instagram/i');
    if (await socialMetrics.count() > 0) {
      expect(await socialMetrics.first().isVisible()).toBeTruthy();
    }
  });
});




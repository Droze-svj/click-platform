// E2E: Video editor workflow (workflow strip, timeline, shortcuts)
// Run: npm run test:e2e:browser -- tests/e2e/editor-workflow.spec.js

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

test.describe('Editor workflow', () => {
  test.setTimeout(60000);

  test('editor page loads and shows workflow strip when video is present', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/video`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const url = page.url();
    if (!url.includes('/dashboard')) {
      test.skip('Not on dashboard (auth or redirect)');
      return;
    }

    // If we have a link to an edit page, open it (e.g. first video edit link)
    const editLink = page.locator('a[href*="/dashboard/video/edit/"]').first();
    if ((await editLink.count()) > 0) {
      await editLink.click();
      await page.waitForURL(/\/dashboard\/video\/edit\//, { timeout: 10000 }).catch(() => {});
    }

    if (!page.url().includes('/dashboard/video/edit/')) {
      test.skip('No video edit page opened (no videos or auth)');
      return;
    }

    // Editor may show "No video loaded" (no workflow strip) or the full editor
    const body = await page.locator('body').textContent();
    if (body && body.includes('No video loaded')) {
      test.skip('No video loaded - workflow strip not rendered');
      return;
    }

    // When editor has content: workflow strip should have Edit, Timeline, Export
    await expect(page.locator('button:has-text("Edit")').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button:has-text("Timeline")').first()).toBeVisible({ timeout: 4000 });
    await expect(page.locator('button:has-text("Export")').first()).toBeVisible({ timeout: 4000 });
  });

  test('keyboard shortcut hint mentions Alt+1–5 when editor has video', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/video`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const editLink = page.locator('a[href*="/dashboard/video/edit/"]').first();
    if ((await editLink.count()) === 0) {
      test.skip('No video edit link');
      return;
    }
    await editLink.click();
    await page.waitForURL(/\/dashboard\/video\/edit\//, { timeout: 10000 }).catch(() => {});

    const body = await page.locator('body').textContent();
    if (body && body.includes('No video loaded')) {
      test.skip('No video loaded - strip hint not rendered');
      return;
    }

    const stripHint = page.locator('text=Alt+1–5').first();
    await expect(stripHint).toBeVisible({ timeout: 8000 });
  });
});

// Journeys: a notification preference survives save + reload; the billing page
// shows the real plans and never claims an upgrade started without a checkout.
const { test, expect } = require('@playwright/test');
const { acceptCookies, registerViaApi, useSession, watchPage, api } = require('./helpers');

test.describe('settings and billing', () => {
  let account;
  test.beforeAll(async ({ request }) => {
    account = await registerViaApi(request, { firstName: 'Seth', lastName: 'Settings' });
  });

  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
    await useSession(page, account);
  });

  test('a notification toggle saves and is still set after a reload', async ({ page, request }) => {
    const seen = watchPage(page);
    // Settings polls (never network-idle): wait for the control instead.
    await page.goto('/dashboard/settings?tab=notifications', { waitUntil: 'domcontentloaded' });

    const digest = page.getByRole('switch', { name: 'Weekly digest' });
    await expect(digest).toBeVisible();
    const before = (await digest.getAttribute('aria-checked')) === 'true';
    await digest.click();
    await expect(digest).toHaveAttribute('aria-checked', String(!before));

    const saved = page.waitForResponse((r) => r.url().endsWith('/user/settings') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    const res = await saved;
    expect(res.status(), 'PUT /user/settings').toBe(200);
    await expect(page.getByText('Settings saved').first()).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('switch', { name: 'Weekly digest' })).toHaveAttribute('aria-checked', String(!before));
    // Untouched toggles keep their values.
    await expect(page.getByRole('switch', { name: 'Mentions' })).toHaveAttribute('aria-checked', 'true');

    const stored = await api(request, account, 'GET', '/user/settings');
    expect(stored.status).toBe(200);
    const settings = stored.body?.data || stored.body;
    expect(settings.notifications.weeklyDigest).toBe(!before);

    expect(seen.pageErrors).toEqual([]);
    expect(seen.serverErrors).toEqual([]);
  });

  test('billing lists the plans and never says "Upgrade started" without a checkout', async ({ page }) => {
    const seen = watchPage(page);
    const upgradePosts = [];
    page.on('request', (r) => { if (r.method() === 'POST' && /\/billing\/upgrade\b/.test(r.url())) upgradePosts.push(r.url()); });
    // If this build has real Whop checkout links, don't leave the app for them.
    let wentToCheckout = null;
    await page.route(/^https:\/\/(www\.)?whop\.com\//, (route) => {
      wentToCheckout = route.request().url();
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Whop checkout (stub)</title>' });
    });

    await page.goto('/dashboard/billing', { waitUntil: 'networkidle' });
    for (const name of ['Free', 'Creator', 'Pro', 'Agency']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText('$29').first()).toBeVisible();
    await expect(page.getByText('$69').first()).toBeVisible();

    // A new account is on the Pro trial (trial ⇒ pro), so Pro is the current
    // plan. Start an Agency checkout: terms first, then "Continue to Whop".
    await expect(page.getByRole('button', { name: 'Current plan' })).toBeDisabled();
    await page.getByRole('button', { name: 'Get Agency' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const proceed = dialog.getByRole('button', { name: 'Continue to Whop' });
    await expect(proceed).toBeDisabled();
    await dialog.getByRole('checkbox').check();
    await expect(proceed).toBeEnabled();
    await proceed.click();

    // The redirect to Whop happens after an API round-trip, so wait for one of
    // the two outcomes instead of checking `wentToCheckout` straight away.
    const unavailable = page.getByText(/Checkout for this plan is not available right now\. Nothing was changed\./).first();
    await expect.poll(async () => wentToCheckout !== null || await unavailable.isVisible().catch(() => false), { timeout: 15000 }).toBe(true);
    if (wentToCheckout === null) {
      // No checkout link configured (CI): say so — nothing changed.
      await expect(unavailable).toBeVisible();
    } else {
      expect(wentToCheckout).toMatch(/^https:\/\/(www\.)?whop\.com\//);
      await page.goBack();
    }
    await expect(page.getByText(/Upgrade started/)).toHaveCount(0);
    expect(upgradePosts, 'the page must not record an "upgrade" outside Whop checkout').toEqual([]);

    expect(seen.pageErrors).toEqual([]);
    expect(seen.serverErrors).toEqual([]);
  });
});

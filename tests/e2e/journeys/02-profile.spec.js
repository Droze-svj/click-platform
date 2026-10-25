// Journey: edit the profile with text that used to get mangled (apostrophes,
// quotes, ampersands, angle brackets) plus a URL, save, reload — every field
// comes back exactly as typed (no HTML-escaping on input, no lost save).
const { test, expect } = require('@playwright/test');
const { acceptCookies, registerViaApi, useSession, watchPage, api } = require('./helpers');

test('profile edit with apostrophes/quotes/& and a URL persists exactly across a reload', async ({ page, request }) => {
  const account = await registerViaApi(request, { firstName: 'Profile', lastName: 'Editor' });
  const seen = watchPage(page);
  await acceptCookies(page);
  await useSession(page, account);

  const name = `Zoë O'Brien-Smith`;
  const bio = `I make "how-to" videos & tutorials — it's <fun>, 100% honest & no "fluff".`;
  const website = 'https://example.com/creators/zoe?ref=click&lang=en';

  await page.goto('/dashboard/settings/profile', { waitUntil: 'networkidle' });
  await expect(page.locator('#pf-name')).toHaveValue('Profile Editor');

  await page.locator('#pf-name').fill(name);
  await page.locator('#pf-bio').fill(bio);
  await page.locator('#pf-website').fill(website);
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  const saved = page.waitForResponse((r) => r.url().endsWith('/auth/profile') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save profile' }).first().click();
  const res = await saved;
  expect(res.status(), 'PUT /auth/profile').toBe(200);
  await expect(page.getByText('Profile saved.').first()).toBeVisible();

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#pf-name')).toHaveValue(name);
  await expect(page.locator('#pf-bio')).toHaveValue(bio);
  await expect(page.locator('#pf-website')).toHaveValue(website);

  // And the stored value is the raw text, not an HTML-escaped copy.
  const profile = await api(request, account, 'GET', '/auth/profile');
  expect(profile.status).toBe(200);
  const stored = JSON.stringify(profile.body);
  expect(stored).toContain(JSON.stringify(bio).slice(1, -1));
  expect(stored).not.toMatch(/&amp;|&#x27;|&#39;|&quot;|&lt;/);

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.serverErrors, '5xx API responses').toEqual([]);
});

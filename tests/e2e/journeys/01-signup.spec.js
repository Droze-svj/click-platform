// Journey: a brand-new creator signs up (2 steps), sets up captions, and the
// dashboard greets them by first name.
const { test, expect } = require('@playwright/test');
const { acceptCookies, uniqueEmail, PASSWORD, watchPage, API } = require('./helpers');

test('sign up (2 steps) → caption onboarding → dashboard greets the user by first name', async ({ page, request }) => {
  const seen = watchPage(page);
  await acceptCookies(page);
  const email = uniqueEmail('signup');

  // The register form drops keystrokes typed before hydration — wait it out.
  await page.goto('/register', { waitUntil: 'networkidle' });

  // ── Step 1: credentials ──────────────────────────────────────────────
  const continueBtn = page.getByRole('button', { name: /^Continue/ });
  await expect(continueBtn).toBeDisabled();
  await page.locator('#field-name').fill('Ada Lovelace');
  await page.locator('#field-email').fill(email);
  await page.locator('#field-password').fill(PASSWORD);
  // Terms are required to continue.
  await expect(continueBtn).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(continueBtn).toBeEnabled();
  await continueBtn.click();

  // ── Step 2: personalization ─────────────────────────────────────────
  await expect(page.getByRole('heading', { name: 'What do you create?' })).toBeVisible();
  const niche = page.getByRole('button', { name: /Technology/ });
  await niche.click();
  await expect(niche).toHaveAttribute('aria-pressed', 'true');
  const tiktok = page.getByRole('button', { name: 'TikTok', exact: true });
  await tiktok.click();
  await expect(tiktok).toHaveAttribute('aria-pressed', 'true');
  const goal = page.getByRole('button', { name: /Grow my audience/ });
  await goal.click();
  await expect(goal).toHaveAttribute('aria-pressed', 'true');

  const registered = page.waitForResponse((r) => r.url().endsWith('/auth/register') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Create account/ }).click();
  const regRes = await registered;
  expect(regRes.status(), 'POST /auth/register').toBe(201);

  // ── Caption onboarding ──────────────────────────────────────────────
  await page.waitForURL(/\/dashboard\/onboarding\/captions/);
  await expect(page.getByRole('heading', { name: 'Set up your captions' })).toBeVisible();
  await page.getByRole('button', { name: 'Save & continue' }).click();

  // ── Dashboard ───────────────────────────────────────────────────────
  await page.waitForURL(/\/dashboard\?welcome=1/);
  await expect(page.getByRole('heading', { name: 'Ada', exact: true })).toBeVisible();
  await expect(page.getByText('Your Technology workspace is ready')).toBeVisible();

  // The personalization really reached the account.
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token, 'session token stored after sign-up').toBeTruthy();
  const me = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  expect(me.status()).toBe(200);
  const meBody = await me.json();
  const user = meBody.user || meBody.data?.user || meBody.data;
  expect(user.email).toBe(email);
  expect(user.name).toBe('Ada Lovelace');
  expect(user.niche).toBe('technology');

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.serverErrors, '5xx API responses').toEqual([]);
});

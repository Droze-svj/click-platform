// Journey: session lifecycle — sign out, a protected page bounces to
// /login?next=…, signing in lands back on it; a wrong password is refused with
// a visible error; forgot-password always tells the user what happened.
const { test, expect } = require('@playwright/test');
const { acceptCookies, registerViaApi, useSession, watchPage, API } = require('./helpers');

test.describe('auth', () => {
  test('sign out → protected page redirects to /login?next=… → sign in lands back on it', async ({ page, request }) => {
    const account = await registerViaApi(request, { firstName: 'Sasha', lastName: 'Signout' });
    const seen = watchPage(page);
    await acceptCookies(page);
    await useSession(page, account);

    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Sasha', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).first().click();
    await page.waitForURL(/\/login(\?|$)/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

    // A protected page now sends us to sign in, remembering where we were.
    await page.goto('/dashboard/settings', { waitUntil: 'networkidle' });
    await page.waitForURL(/\/login\?next=/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/dashboard/settings');

    await page.locator('#field-email').fill(account.email);
    await page.locator('#field-password').fill(account.password);
    const login = page.waitForResponse((r) => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /^(Sign in|Log in|Login)$/i }).click();
    expect((await login).status()).toBe(200);

    await page.waitForURL((u) => u.pathname === '/dashboard/settings');
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy();
    await expect(page.locator('h1').first()).toBeVisible();

    expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
    expect(seen.serverErrors, '5xx API responses').toEqual([]);
  });

  test('a wrong password is refused with a visible error and no session', async ({ page, request }) => {
    const account = await registerViaApi(request, { firstName: 'Wren', lastName: 'Wrongpass' });
    await acceptCookies(page);
    await page.goto('/login', { waitUntil: 'networkidle' });

    await page.locator('#field-email').fill(account.email);
    await page.locator('#field-password').fill('Definitely-Not-It-42!');
    const login = page.waitForResponse((r) => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /^(Sign in|Log in|Login)$/i }).click();
    expect((await login).status()).toBe(401);

    await expect(page.getByRole('alert').filter({ hasText: /invalid email or password/i })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

    // The right password still works afterwards (one miss doesn't lock you out).
    await page.locator('#field-password').fill(account.password);
    await page.getByRole('button', { name: /^(Sign in|Log in|Login)$/i }).click();
    await page.waitForURL((u) => u.pathname.startsWith('/dashboard'));
  });

  test('forgot password tells the user what happened', async ({ page, request }) => {
    const account = await registerViaApi(request, { firstName: 'Fern', lastName: 'Forgot' });
    await acceptCookies(page);
    await page.goto('/forgot-password', { waitUntil: 'networkidle' });

    // Empty submit is caught client-side.
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.locator('form [role="alert"]')).toHaveText('Enter the email address on your Click account.');

    await page.locator('#email').fill(account.email);
    const sent = page.waitForResponse((r) => r.url().endsWith('/auth/forgot-password'));
    await page.getByRole('button', { name: 'Send reset link' }).click();
    const res = await sent;
    const body = await res.json().catch(() => ({}));

    if (res.status() === 503 && body.code === 'EMAIL_UNAVAILABLE') {
      // No email provider configured (CI, local): the honest "can't send"
      // message — never a fake "check your email".
      await expect(page.locator('form [role="alert"]')).toHaveText(
        "We can't send reset emails right now. Please contact support to reset your password.",
      );
      await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0);
    } else {
      expect(res.status(), `forgot-password answered ${res.status()} ${JSON.stringify(body)}`).toBeLessThan(300);
      await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
      await expect(page.getByRole('status')).toContainText(account.email);
    }

    // The server answers the same way for an unknown address (no account
    // enumeration): same status as for the real account.
    const unknown = await request.post(`${API}/auth/forgot-password`, { data: { email: 'nobody.here@example.com' } });
    expect(unknown.status()).toBe(res.status());
  });
});

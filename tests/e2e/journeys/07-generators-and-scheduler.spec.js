// Journeys: the scheduler tells a creator with no connected account exactly
// what's wrong; the content generator produces posts (AI mocked in test mode);
// the script writer produces a script or says honestly that it couldn't.
const { test, expect } = require('@playwright/test');
const { acceptCookies, registerViaApi, useSession, watchPage, api } = require('./helpers');

test.describe('creation tools', () => {
  let account;
  test.beforeAll(async ({ request }) => {
    account = await registerViaApi(request, { firstName: 'Cora', lastName: 'Creator' });
  });

  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
    await useSession(page, account);
  });

  test('scheduler without a connected account says which account is missing — and refuses to queue', async ({ page, request }) => {
    const seen = watchPage(page);
    await page.goto('/dashboard/scheduler', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Select TikTok' }).click();
    await expect(page.getByRole('button', { name: 'Select TikTok' })).toHaveAttribute('aria-pressed', 'true');
    const missing = page.getByRole('link', { name: /No tiktok account connected/i });
    await expect(missing).toBeVisible();
    await expect(missing).toHaveAttribute('href', '/dashboard/social?platform=tiktok');

    // Try to queue anyway: the server refuses, and the UI says why (not a
    // generic "try again").
    await page.getByPlaceholder('Write your caption…').fill('Behind the scenes of today\'s shoot & what\'s next');
    const when = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const local = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T10:30`;
    await page.getByLabel('Scheduled time').fill(local);
    const scheduled = page.waitForResponse((r) => r.url().includes('/scheduler/schedule') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add to queue' }).click();
    const res = await scheduled;
    expect(res.status(), 'scheduling without a connected account is refused').toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    const body = await res.json().catch(() => ({}));
    expect(['PLATFORM_NOT_CONNECTED', 'ACCOUNT_NOT_CONNECTED']).toContain(body.code);
    await expect(page.getByText('No TikTok account connected').first()).toBeVisible();

    // Nothing was queued.
    const posts = await api(request, account, 'GET', '/scheduler');
    expect(posts.status).toBe(200);
    expect(posts.body.data).toEqual([]);

    expect(seen.pageErrors).toEqual([]);
    expect(seen.serverErrors).toEqual([]);
  });

  test('content generator turns an idea into platform posts', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);
    const seen = watchPage(page);
    await page.goto('/dashboard/content', { waitUntil: 'networkidle' });

    const idea = 'How I batch-film a week of short videos in two hours: one outfit, three locations, a shot list, and ruthless editing.';
    await page.locator('#logicSeed').fill(idea);
    const generate = page.getByRole('button', { name: 'Generate posts' });
    const started = page.waitForResponse((r) => r.url().endsWith('/content/generate') && r.request().method() === 'POST');
    await generate.click();
    const res = await started;
    expect(res.status(), 'POST /content/generate').toBeLessThan(300);
    const body = await res.json();
    expect(body.data?.contentId || body.contentId).toBeTruthy();

    // Results land on screen: the "Social posts" section with at least one
    // post card that has a copy action.
    await expect(page.getByRole('heading', { name: 'Social posts' })).toBeVisible({ timeout: 120000 });
    await expect(page.getByRole('button', { name: 'Copy content' }).first()).toBeVisible();
    await expect(page.locator('[role="alert"]').filter({ hasText: /fail|error|timed out/i })).toHaveCount(0);

    expect(seen.pageErrors).toEqual([]);
    expect(seen.serverErrors).toEqual([]);
  });

  test('script writer generates a script, or says honestly that it could not', async ({ page, request }) => {
    test.setTimeout(3 * 60 * 1000);
    const seen = watchPage(page);
    await page.goto('/dashboard/scripts', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'New script' }).click();
    const topic = `Three editing habits that doubled my retention ${Date.now().toString(36)}`;
    await page.getByPlaceholder("What's your script about?").fill(topic);
    const generated = page.waitForResponse((r) => r.url().endsWith('/scripts/generate') && r.request().method() === 'POST', { timeout: 150000 });
    await page.getByRole('button', { name: 'Generate script' }).click();
    const res = await generated;

    let allowed = [];
    if (res.ok()) {
      await expect(page.getByText('✓ Script generated').first()).toBeVisible();
      // It is in the list and really has a script body.
      await expect(page.getByRole('heading', { name: topic })).toBeVisible();
      const list = await api(request, account, 'GET', '/scripts');
      const scripts = list.body?.data?.scripts || list.body?.data || list.body?.scripts || [];
      const mine = (Array.isArray(scripts) ? scripts : []).find((s) => s.topic === topic);
      expect(mine, 'the generated script is saved').toBeTruthy();
      const one = await api(request, account, 'GET', `/scripts/${mine._id}`);
      const script = (one.body?.data || one.body)?.script || '';
      expect(script.trim().length, 'the saved script has a body').toBeGreaterThan(20);
    } else {
      // Honest failure: a 4xx, or 503 "unavailable" (what the keyless test
      // server answers: the mocked AI reply isn't a usable script, and the route
      // refuses to save a template as if it were one) — with a visible message.
      // Never a 500, never a fake success.
      expect([400, 402, 403, 422, 429, 503], `script generation answered ${res.status()}`).toContain(res.status());
      if (res.status() === 503) allowed = [`503 POST ${res.url()}`];
      await expect(page.getByText("Couldn't generate the script").first()).toBeVisible();
      await expect(page.getByText('✓ Script generated')).toHaveCount(0);
    }

    expect(seen.pageErrors).toEqual([]);
    expect(seen.serverErrors.filter((e) => !allowed.includes(e))).toEqual([]);
  });
});

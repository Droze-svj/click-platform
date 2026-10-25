// Journey: AI Auto Edit from the auto-edit page. The server runs with
// NODE_ENV=test (AI mocked, deterministic), so this asserts the PIPELINE —
// analyze answers, the edit completes, the editor gets an editedVideoUrl, and
// that URL is a real, decodable video — not the creative quality of the cut.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  API, acceptCookies, registerViaApi, useSession, watchPage, probe, hasFfprobe, absoluteMediaUrl,
} = require('./helpers');

const CLIP = path.join(__dirname, '..', '..', 'fixtures', 'journey-clip.mp4');

test('AI auto edit: analyze → compose → the result is a real edited video the editor can open', async ({ page, request }, testInfo) => {
  test.setTimeout(6 * 60 * 1000);
  const account = await registerViaApi(request, { firstName: 'Ari', lastName: 'Autoedit' });
  const seen = watchPage(page);
  await acceptCookies(page);
  await useSession(page, account);

  // Upload through the API (the UI upload has its own journey).
  const up = await request.post(`${API}/video/upload`, {
    headers: { Authorization: `Bearer ${account.token}` },
    multipart: {
      video: { name: 'journey-clip.mp4', mimeType: 'video/mp4', buffer: fs.readFileSync(CLIP) },
      title: 'Auto edit journey',
    },
  });
  const upBody = await up.json();
  expect(up.status(), JSON.stringify(upBody).slice(0, 300)).toBeLessThan(300);
  const contentId = upBody.data?.contentId || upBody.contentId;
  expect(contentId).toBeTruthy();

  await page.goto(`/dashboard/video/edit/${contentId}`, { waitUntil: 'networkidle' });

  // ── Analyze ─────────────────────────────────────────────────────────
  const analyzeBtn = page.getByRole('button', { name: /Analyze video/i });
  await expect(analyzeBtn).toBeVisible({ timeout: 30000 });
  const analyzed = page.waitForResponse((r) => r.url().includes('/ai-editing/analyze') && r.request().method() === 'POST', { timeout: 120000 });
  await analyzeBtn.click();
  const analyzeRes = await analyzed;
  expect(analyzeRes.status(), 'POST /video/ai-editing/analyze').toBe(200);

  // ── Compose (the auto edit) ─────────────────────────────────────────
  const compose = page.getByRole('button', { name: /^Compose \d+ clips?$/ });
  await expect(compose).toBeEnabled();
  const edited = page.waitForResponse((r) => r.url().includes('/ai-editing/auto-edit') && r.request().method() === 'POST', { timeout: 5 * 60 * 1000 });
  await compose.click();
  const editRes = await edited;
  const editBody = await editRes.json().catch(() => ({}));
  expect(editRes.status(), `auto-edit → ${JSON.stringify(editBody).slice(0, 500)}`).toBe(200);
  const result = editBody.data || editBody;
  const editedVideoUrl = result.editedVideoUrl || result.result?.editedVideoUrl;
  expect(editedVideoUrl, 'auto-edit returns editedVideoUrl').toBeTruthy();
  expect(Array.isArray(result.editsApplied), 'auto-edit reports the edits it applied').toBe(true);

  // The page shows the finished edit, with a download of exactly that file.
  await expect(page.getByRole('heading', { name: 'Your edit is ready' })).toBeVisible({ timeout: 30000 });
  const download = page.getByRole('link', { name: 'Download the edited video' });
  await expect(download).toHaveAttribute('href', new RegExp(editedVideoUrl.replace(/^https?:\/\/[^/]+/, '').split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // The output exists and is a real video.
  const fileRes = await request.get(absoluteMediaUrl(editedVideoUrl), { headers: { Authorization: `Bearer ${account.token}` } });
  expect(fileRes.status(), `GET ${editedVideoUrl}`).toBe(200);
  const bytes = await fileRes.body();
  expect(bytes.length).toBeGreaterThan(10000);
  const out = testInfo.outputPath('auto-edit.mp4');
  fs.writeFileSync(out, bytes);
  if (hasFfprobe()) {
    const info = probe(out);
    expect(info.streams).toContain('video');
    expect(info.duration).toBeGreaterThan(0.5);
    expect(info.duration).toBeLessThan(8.5);
    // Silence trimming is plain DSP (not AI): when the pipeline says it cut
    // silences, the fixture's two ~0.7 s gaps must really be gone.
    if (result.editsApplied.some((e) => /silen/i.test(String(e)))) {
      expect(info.duration, `edits: ${JSON.stringify(result.editsApplied)}`).toBeLessThan(8 - 0.8);
    }
  }

  // "Open in Editor" opens the manual editor on the edited cut.
  await page.getByRole('button', { name: /Open in Editor/ }).click();
  await expect(page.getByTestId('timeline-toolbar')).toBeVisible({ timeout: 60000 });

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.serverErrors, '5xx API responses').toEqual([]);
});

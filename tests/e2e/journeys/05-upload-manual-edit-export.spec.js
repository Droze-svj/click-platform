// Journey: upload a real clip through the Video Studio's file input → the
// editor opens on it → manual edit (split at 5 s, delete the first part) →
// Share & export → Render. The render API must return a URL, and the file it
// points at must be a real video whose duration matches what was kept.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  acceptCookies, registerViaApi, useSession, watchPage, probe, silences, hasFfprobe, absoluteMediaUrl,
} = require('./helpers');

const CLIP = path.join(__dirname, '..', '..', 'fixtures', 'journey-clip.mp4');
const CLIP_SECONDS = 8;
const SPLIT_AT = 5; // seconds, typed into the timeline's go-to-time field

/** Upload through the UI; returns the new content id. */
async function uploadThroughStudio(page) {
  await page.goto('/dashboard/video', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Video Studio' })).toBeVisible();
  const uploaded = page.waitForResponse(
    (r) => /\/video\/upload$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
    { timeout: 60000 },
  );
  await page.locator('input[type="file"]').first().setInputFiles(CLIP);
  const res = await uploaded;
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `POST /video/upload → ${JSON.stringify(body).slice(0, 300)}`).toBeLessThan(300);
  const contentId = body.data?.contentId || body.contentId;
  expect(contentId, 'upload returns a contentId').toBeTruthy();
  return contentId;
}

/** The editor's timeline segments on the main video track, in time order. */
async function mainTrackSegments(page) {
  return page.locator('[data-track-drop="0"] [data-segment-id]').evaluateAll((els) => els
    .map((el) => ({ id: el.getAttribute('data-segment-id'), left: parseFloat(el.style.left), width: parseFloat(el.style.width) }))
    .sort((a, b) => a.left - b.left));
}

test('upload → editor → split + delete the first part → export renders exactly the kept range', async ({ page, request }, testInfo) => {
  test.setTimeout(6 * 60 * 1000);
  const account = await registerViaApi(request, { firstName: 'Uma', lastName: 'Uploader' });
  const seen = watchPage(page);
  await acceptCookies(page);
  await useSession(page, account);

  // ── Upload → lands in the editor (AI auto-edit setup first) ─────────
  const contentId = await uploadThroughStudio(page);
  await page.waitForURL(new RegExp(`/dashboard/video/edit/${contentId}\\?.*autoCaptions=1`), { timeout: 30000 });
  await expect(page.getByRole('button', { name: /Analyze video/i })).toBeVisible({ timeout: 30000 });

  // ── Manual editor ───────────────────────────────────────────────────
  await page.goto(`/dashboard/video/edit/${contentId}?mode=manual`, { waitUntil: 'domcontentloaded' });
  const toolbar = page.getByTestId('timeline-toolbar');
  await expect(toolbar).toBeVisible({ timeout: 60000 });
  await expect.poll(async () => (await mainTrackSegments(page)).length, { timeout: 30000 }).toBe(1);

  // Snap off, so the playhead lands exactly where we type (not on a nearby
  // speech/beat snap point), then go to 0:05 with the timecode field.
  const snap = page.getByTestId('timeline-snap');
  if ((await snap.getAttribute('aria-pressed')) === 'true') await snap.click();
  await expect(snap).toHaveAttribute('aria-pressed', 'false');
  const goTo = page.getByRole('textbox', { name: /Go to time/ });
  await goTo.fill(`0:0${SPLIT_AT}`);
  await goTo.press('Enter');
  const split = page.getByTestId('timeline-split');
  await expect(split).toBeEnabled();
  await split.click();

  await expect.poll(async () => (await mainTrackSegments(page)).length).toBe(2);
  const [first, second] = await mainTrackSegments(page);
  // 5 s of an 8 s clip: the first piece is 62.5 % of the track.
  expect(first.width / (first.width + second.width)).toBeCloseTo(SPLIT_AT / CLIP_SECONDS, 1);

  await page.locator(`[data-segment-id="${first.id}"]`).click();
  const del = page.getByTestId('timeline-delete');
  await expect(del).toBeEnabled();
  await del.click();
  await expect.poll(async () => (await mainTrackSegments(page)).map((s) => s.id)).toEqual([second.id]);

  // ── Export → Render ───────────────────────────────────────────────
  await page.getByRole('button', { name: 'Export', exact: true }).first().click();
  const renderBtn = page.getByRole('button', { name: 'Render', exact: true });
  await expect(renderBtn).toBeEnabled({ timeout: 30000 });
  const rendered = page.waitForResponse(
    (r) => r.url().includes('/manual-editing/render') && r.request().method() === 'POST',
    { timeout: 4 * 60 * 1000 },
  );
  await renderBtn.click();
  const renderRes = await rendered;
  const sent = renderRes.request().postDataJSON() || {};
  const body = await renderRes.json().catch(() => ({}));
  expect(renderRes.status(), `render → ${JSON.stringify(body).slice(0, 400)}`).toBe(200);
  const url = body.data?.url || body.data?.downloadUrl || body.url || body.downloadUrl;
  expect(url, 'render returns a URL').toBeTruthy();

  // What the editor asked for: one segment whose source window is the kept part.
  const segs = (sent.timelineSegments || []).filter((s) => (s.track ?? 0) === 0 && s.type !== 'audio');
  expect(segs, 'one main-track segment sent to the renderer').toHaveLength(1);
  const kept = CLIP_SECONDS - SPLIT_AT;

  await expect(page.getByText('Your video is ready to download.').first()).toBeVisible({ timeout: 30000 });

  // ── The file itself ─────────────────────────────────────────────────
  const fileRes = await request.get(absoluteMediaUrl(url), { headers: { Authorization: `Bearer ${account.token}` } });
  expect(fileRes.status(), `GET ${url}`).toBe(200);
  const bytes = await fileRes.body();
  expect(bytes.length, 'rendered file is not empty').toBeGreaterThan(10000);
  const out = testInfo.outputPath('manual-render.mp4');
  fs.writeFileSync(out, bytes);

  if (hasFfprobe()) {
    const info = probe(out);
    expect(info.streams).toContain('video');
    expect(info.duration, `rendered duration ${info.duration}s vs kept ${kept}s`).toBeGreaterThan(kept - 0.3);
    expect(info.duration).toBeLessThan(kept + 0.3);
    // And it is the RIGHT 3 s: the fixture's tone drops out at 5.5–6.2 s, so
    // the kept tail (5–8 s) must start with ~0.5 s of tone, then that gap.
    const gaps = silences(out);
    if (gaps) {
      const gap = gaps.find((g) => g.start < kept);
      expect(gap, `silent gaps in the render: ${JSON.stringify(gaps)}`).toBeTruthy();
      expect(gap.start).toBeGreaterThan(5.5 - SPLIT_AT - 0.3);
      expect(gap.start).toBeLessThan(5.5 - SPLIT_AT + 0.3);
    }
  } else {
    testInfo.annotations.push({ type: 'note', description: 'ffprobe not installed — duration not checked' });
  }

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.serverErrors, '5xx API responses').toEqual([]);
});

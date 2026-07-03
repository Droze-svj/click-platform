// Behavioral tests for Smart Repurpose Studio core logic (pure + injected adaptFn).

const {
  aspectFor,
  normalizePlatforms,
  buildVariantPreviews,
  buildScheduleRows,
  VALID_PLATFORMS,
  MAX_VARIANTS,
} = require('../../server/services/repurposeStudioService');

describe('repurposeStudio.normalizePlatforms', () => {
  test('de-dupes, drops unknown, caps at MAX_VARIANTS', () => {
    const many = Array.from({ length: MAX_VARIANTS + 5 }, () => 'tiktok').concat(['nope', 'youtube']);
    const out = normalizePlatforms(many);
    expect(out.length).toBeLessThanOrEqual(MAX_VARIANTS);
    expect(out.every((p) => VALID_PLATFORMS.includes(p))).toBe(true);
  });
  test('empty/all-unknown falls back to tiktok', () => {
    expect(normalizePlatforms([])).toEqual(['tiktok']);
    expect(normalizePlatforms(['nope'])).toEqual(['tiktok']);
  });
});

describe('repurposeStudio.aspectFor', () => {
  test('returns platform aspect + format', () => {
    expect(aspectFor('youtube')).toEqual({ aspectRatio: '16:9', format: 'landscape (9:16 for Shorts)' });
    expect(aspectFor('unknown')).toEqual({ aspectRatio: '9:16', format: 'vertical' });
  });
});

describe('repurposeStudio.buildVariantPreviews (injected adaptFn)', () => {
  const adaptFn = async (platform, text) => ({
    content: `[${platform}] ${text}`,
    hashtags: [`#${platform}`],
    score: 90,
    suggestions: ['tighten hook'],
  });

  test('one variant per platform, carrying adapted copy + aspect', async () => {
    const variants = await buildVariantPreviews(
      { text: 'hi', title: 'T', userId: 'u', platforms: ['tiktok', 'youtube'] },
      adaptFn,
    );
    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({ platform: 'tiktok', content: '[tiktok] hi', aspectRatio: '9:16' });
    expect(variants[1]).toMatchObject({ platform: 'youtube', aspectRatio: '16:9' });
  });

  test('a failing adaptation falls back to the source text, never throws', async () => {
    const boom = async () => { throw new Error('AI down'); };
    const variants = await buildVariantPreviews({ text: 'src', title: 'T', userId: 'u', platforms: ['tiktok'] }, boom);
    expect(variants[0].content).toBe('src');
    expect(variants[0].score).toBe(70); // catch fallback score
  });
});

describe('repurposeStudio.buildScheduleRows', () => {
  const startAt = Date.parse('2026-02-01T09:00:00Z');
  const variants = [
    { platform: 'tiktok', content: 'a', hashtags: ['#x'] },
    { platform: 'youtube', content: 'b' },
    { platform: 'nope', content: 'dropped' }, // invalid platform → filtered out
  ];

  test('maps valid variants → rows on their own platform, spread by cadence', () => {
    const rows = buildScheduleRows('u1', variants, { startAt, cadenceHours: 6 });
    expect(rows).toHaveLength(2); // 'nope' dropped
    expect(rows[0]).toMatchObject({ userId: 'u1', platform: 'tiktok', status: 'pending_approval' });
    expect(rows[0].content).toEqual({ text: 'a', hashtags: ['#x'] });
    expect(rows[1].scheduledTime.getTime()).toBe(startAt + 6 * 3600 * 1000);
  });

  test("status 'scheduled' is honoured; anything else → pending_approval", () => {
    expect(buildScheduleRows('u', variants, { status: 'scheduled' })[0].status).toBe('scheduled');
    expect(buildScheduleRows('u', variants, { status: 'whatever' })[0].status).toBe('pending_approval');
  });

  test('all rows share one rep_ plan id', () => {
    const rows = buildScheduleRows('u', variants, {});
    const ids = new Set(rows.map((r) => r.autopilotPlanId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toMatch(/^rep_[a-f0-9]+$/);
  });
});

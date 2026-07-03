// Behavioral tests for the Content Series Planner (pure + injected deps).

const {
  clampParts,
  buildSeriesPrompt,
  shapeSeries,
  generateSeries,
  seriesToIdeas,
} = require('../../server/services/contentSeriesService');

describe('contentSeries.clampParts', () => {
  test('clamps to [2,10], defaults on garbage', () => {
    expect(clampParts(5)).toBe(5);
    expect(clampParts(1)).toBe(2);
    expect(clampParts(50)).toBe(10);
    expect(clampParts('x')).toBe(5);
  });
});

describe('contentSeries.buildSeriesPrompt', () => {
  test('frames a connected series (not independent posts) with the theme + count', () => {
    const p = buildSeriesPrompt({ theme: 'saving money', niche: 'finance', parts: 3, platform: 'tiktok' });
    expect(p).toContain('3-part');
    expect(p).toContain('saving money');
    expect(p).toContain('finance');
    expect(p).toMatch(/build on the previous/i);
    expect(p).toMatch(/JSON array of exactly 3/);
  });
});

describe('contentSeries.shapeSeries', () => {
  const raw = JSON.stringify([
    { part: 1, title: 'Setup', hook: 'h1', description: 'd1' },
    { part: 2, title: 'Develop', hook: 'h2', description: 'd2' },
    { part: 3, title: 'Payoff', hook: 'h3', description: 'd3' },
  ]);

  test('parses ordered parts and renumbers authoritatively', () => {
    const out = shapeSeries(raw, 3);
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.part)).toEqual([1, 2, 3]);
    expect(out[0]).toMatchObject({ part: 1, title: 'Setup', hook: 'h1' });
  });

  test('caps to requested part count and renumbers even if model over-returns', () => {
    const four = JSON.parse(raw).concat({ part: 9, title: 'Extra' });
    const out = shapeSeries(JSON.stringify(four), 3);
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.part)).toEqual([1, 2, 3]);
  });

  test('parses JSON embedded in prose; garbage → empty', () => {
    expect(shapeSeries('Here: [{"title":"A"}] done', 2)[0].title).toBe('A');
    expect(shapeSeries('no json', 3)).toEqual([]);
  });
});

describe('contentSeries.generateSeries (injected deps)', () => {
  const deps = {
    sanitize: (t) => String(t).trim(),
    generate: async () => '[{"title":"P1","hook":"a"},{"title":"P2","hook":"b"}]',
    assertBudget: async () => {},
    recordUsage: async () => {},
  };

  test('returns normalized ordered parts', async () => {
    const out = await generateSeries({ theme: 'x', niche: 'tech', parts: 2, platform: 'youtube' }, deps);
    expect(out).toMatchObject({ niche: 'tech', platform: 'youtube' });
    expect(out.parts.map((p) => p.part)).toEqual([1, 2]);
  });

  test('rejects an empty theme with 400 before generating', async () => {
    let gen = false;
    const d = { ...deps, generate: async () => { gen = true; return '[]'; } };
    await expect(generateSeries({ theme: '  ', parts: 3 }, d)).rejects.toMatchObject({ statusCode: 400 });
    expect(gen).toBe(false);
  });
});

describe('contentSeries.seriesToIdeas', () => {
  test('maps parts → calendar-idea shape in order, tagging the platform', () => {
    const ideas = seriesToIdeas([{ part: 1, title: 'T', hook: 'H', description: 'D' }], 'tiktok');
    expect(ideas[0]).toEqual({ title: 'T', hook: 'H', description: 'D', platform: 'tiktok' });
  });
});

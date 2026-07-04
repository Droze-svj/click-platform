// Behavioral tests for the Carousel/Thread Composer core (pure + injected AI).

const {
  normalizeFormat,
  clampCount,
  buildPrompt,
  shapeSlides,
  composeSlides,
} = require('../../server/services/carouselComposerService');

describe('carouselComposer.normalizeFormat / clampCount', () => {
  test('unknown format → carousel; known formats pass', () => {
    expect(normalizeFormat('zzz')).toBe('carousel');
    expect(normalizeFormat('thread')).toBe('thread');
    expect(normalizeFormat(undefined)).toBe('carousel');
  });
  test('slide count clamps to 3–10, default 6', () => {
    expect(clampCount(1)).toBe(3);
    expect(clampCount(50)).toBe(10);
    expect(clampCount(7)).toBe(7);
    expect(clampCount('x')).toBe(6);
  });
});

describe('carouselComposer.buildPrompt', () => {
  test('embeds format guidance, topic, and the exact slide count', () => {
    const p = buildPrompt({ format: 'thread', topic: 'ship faster', count: 5 });
    expect(p).toContain('ship faster');
    expect(p).toContain('X/Threads thread');
    expect(p).toContain('Exactly 5 slides');
    expect(p).toMatch(/JSON array of 5 strings/);
  });
});

describe('carouselComposer.shapeSlides', () => {
  test('numbers slides 1..n in order from a JSON string array', () => {
    const out = shapeSlides(JSON.stringify(['Hook', 'Point A', 'CTA']), 6);
    expect(out).toEqual([
      { n: 1, text: 'Hook' },
      { n: 2, text: 'Point A' },
      { n: 3, text: 'CTA' },
    ]);
  });
  test('strips any leading numbering the model added', () => {
    const out = shapeSlides(JSON.stringify(['1. Hook', 'Slide 2: Point', '3) CTA']), 6);
    expect(out.map((s) => s.text)).toEqual(['Hook', 'Point', 'CTA']);
  });
  test('caps at the clamped count', () => {
    const raw = JSON.stringify(Array.from({ length: 12 }, (_, i) => `s${i}`));
    expect(shapeSlides(raw, 4)).toHaveLength(4);
    expect(shapeSlides(raw, 1)).toHaveLength(3); // min clamp
  });
  test('falls back to line-splitting; empty → []', () => {
    expect(shapeSlides('1. First\n2) Second\n- Third', 6).map((s) => s.text))
      .toEqual(['First', 'Second', 'Third']);
    expect(shapeSlides('', 6)).toEqual([]);
    expect(shapeSlides(null, 6)).toEqual([]);
  });
  test('extracts a JSON array embedded in prose', () => {
    const out = shapeSlides('Sure:\n["A","B"]\nEnjoy', 6);
    expect(out.map((s) => s.text)).toEqual(['A', 'B']);
  });
});

describe('carouselComposer.composeSlides (injected deps, no AI/network)', () => {
  const baseDeps = () => {
    const calls = { assertBudget: 0, recordUsage: 0 };
    return {
      calls,
      sanitize: (t, cap) => String(t || '').slice(0, cap),
      generate: async () => JSON.stringify(['Hook slide', 'Middle', 'CTA slide']),
      assertBudget: async () => { calls.assertBudget += 1; },
      recordUsage: async () => { calls.recordUsage += 1; },
    };
  };

  test('throws 400 when the topic is empty', async () => {
    await expect(composeSlides({ format: 'thread', topic: '  ' }, baseDeps()))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('returns ordered slides and runs budget + usage accounting', async () => {
    const deps = baseDeps();
    const out = await composeSlides({ format: 'thread', topic: 'launch', count: 3 }, deps);
    expect(out.format).toBe('thread');
    expect(out.slides).toEqual([
      { n: 1, text: 'Hook slide' },
      { n: 2, text: 'Middle' },
      { n: 3, text: 'CTA slide' },
    ]);
    expect(deps.calls.assertBudget).toBe(1);
    expect(deps.calls.recordUsage).toBe(1);
  });

  test('normalizes an unknown format to carousel in the result', async () => {
    const out = await composeSlides({ format: 'bogus', topic: 'x' }, baseDeps());
    expect(out.format).toBe('carousel');
  });
});

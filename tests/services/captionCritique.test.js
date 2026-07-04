// Behavioral tests for the Caption Critique core (pure prompt/parse + injected AI).

const {
  DIMENSION_KEYS,
  MAX_SUGGESTIONS,
  clampScore,
  buildPrompt,
  shapeCritique,
  critiquePost,
} = require('../../server/services/captionCritiqueService');

describe('captionCritique.clampScore', () => {
  test('rounds and clamps to [1,10]; non-numbers → 1', () => {
    expect(clampScore(7.4)).toBe(7);
    expect(clampScore(0)).toBe(1);
    expect(clampScore(99)).toBe(10);
    expect(clampScore('x')).toBe(1);
    expect(clampScore(null)).toBe(1);
  });
});

describe('captionCritique.buildPrompt', () => {
  test('embeds platform, text, every dimension, and a JSON contract', () => {
    const p = buildPrompt({ platform: 'tiktok', text: 'buy my thing' });
    expect(p).toContain('tiktok');
    expect(p).toContain('buy my thing');
    for (const k of DIMENSION_KEYS) expect(p).toContain(`- ${k}:`);
    expect(p).toMatch(/Return ONLY JSON/);
  });
});

describe('captionCritique.shapeCritique', () => {
  test('parses JSON, clamps scores, keeps overall, caps suggestions', () => {
    const raw = JSON.stringify({
      scores: { hook: 8, clarity: 12, cta: 0, value: 6 },
      overall: 7, summary: 'Solid but no CTA.',
      suggestions: ['Add a CTA', 'Add a CTA', 'Tighten the hook', 'a', 'b', 'c', 'd'],
    });
    const out = shapeCritique(raw);
    expect(out.scores).toEqual({ hook: 8, clarity: 10, cta: 1, value: 6 });
    expect(out.overall).toBe(7);
    expect(out.summary).toBe('Solid but no CTA.');
    // De-duped ("Add a CTA" once) and capped.
    expect(out.suggestions).toHaveLength(MAX_SUGGESTIONS);
    expect(out.suggestions[0]).toBe('Add a CTA');
  });

  test('computes overall as the rounded dimension average when missing/invalid', () => {
    const out = shapeCritique(JSON.stringify({ scores: { hook: 10, clarity: 8, cta: 6, value: 4 } }));
    expect(out.overall).toBe(7); // (10+8+6+4)/4 = 7
  });

  test('extracts JSON embedded in prose and fills missing dimensions with 1', () => {
    const out = shapeCritique('Here is your critique:\n{"scores":{"hook":9},"suggestions":[]}\nDone')
    expect(out.scores.hook).toBe(9)
    expect(out.scores.clarity).toBe(1)
    expect(out.suggestions).toEqual([])
  });

  test('garbage input yields a stable all-1 scorecard', () => {
    const out = shapeCritique('not json at all');
    expect(out.scores).toEqual({ hook: 1, clarity: 1, cta: 1, value: 1 });
    expect(out.overall).toBe(1);
    expect(out.suggestions).toEqual([]);
  });
});

describe('captionCritique.critiquePost (injected deps, no AI/network)', () => {
  const baseDeps = () => {
    const calls = { assertBudget: 0, recordUsage: 0 };
    return {
      calls,
      sanitize: (t, cap) => String(t || '').slice(0, cap),
      generate: async () => JSON.stringify({
        scores: { hook: 6, clarity: 7, cta: 3, value: 8 },
        overall: 6, summary: 'Good value, weak CTA.', suggestions: ['End with a clear ask.'],
      }),
      assertBudget: async () => { calls.assertBudget += 1; },
      recordUsage: async () => { calls.recordUsage += 1; },
    };
  };

  test('throws 400 when the text is empty', async () => {
    await expect(critiquePost({ platform: 'x', text: '   ' }, baseDeps()))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('returns a shaped scorecard and runs budget + usage accounting', async () => {
    const deps = baseDeps();
    const out = await critiquePost({ platform: 'instagram', text: 'my post' }, deps);
    expect(out.platform).toBe('instagram');
    expect(out.scores.value).toBe(8);
    expect(out.overall).toBe(6);
    expect(out.suggestions).toEqual(['End with a clear ask.']);
    expect(deps.calls.assertBudget).toBe(1);
    expect(deps.calls.recordUsage).toBe(1);
  });
});

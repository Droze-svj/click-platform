// Behavioral tests for the First-Comment Generator (pure + injected deps).

const {
  buildPrompt,
  shapeOptions,
  normalizeGoal,
  generateFirstComments,
} = require('../../server/services/firstCommentService');

describe('firstComment.normalizeGoal / buildPrompt', () => {
  test('unknown goal falls back to engagement', () => {
    expect(normalizeGoal('nope')).toBe('engagement');
    expect(normalizeGoal('cta')).toBe('cta');
  });
  test('prompt embeds platform, goal guidance, source, and JSON instruction', () => {
    const p = buildPrompt({ platform: 'tiktok', goal: 'cta', sourceText: 'my new video' });
    expect(p).toContain('tiktok');
    expect(p).toContain('call-to-action');
    expect(p).toContain('my new video');
    expect(p).toMatch(/JSON array of 3 strings/);
  });
});

describe('firstComment.shapeOptions', () => {
  test('parses a JSON array of strings', () => {
    const out = shapeOptions('["Which one would you pick?", "Save this for later", "Drop a 🔥"]', 'engagement');
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ text: 'Which one would you pick?', goal: 'engagement' });
  });
  test('parses JSON embedded in prose, and objects with .text', () => {
    const out = shapeOptions('Sure! [{"text":"A?"},{"text":"B?"}]', 'cta');
    expect(out.map((o) => o.text)).toEqual(['A?', 'B?']);
    expect(out[0].goal).toBe('cta');
  });
  test('falls back to numbered/bulleted lines when not JSON', () => {
    const out = shapeOptions('1. First option\n2) Second option\n- Third option', 'link');
    expect(out.map((o) => o.text)).toEqual(['First option', 'Second option', 'Third option']);
  });
  test('de-dupes and caps at 3', () => {
    const out = shapeOptions('["a","a","b","c","d"]', 'engagement');
    expect(out.map((o) => o.text)).toEqual(['a', 'b', 'c']);
  });
  test('empty/garbage → empty array', () => {
    expect(shapeOptions('', 'engagement')).toEqual([]);
    expect(shapeOptions(null, 'engagement')).toEqual([]);
  });
});

describe('firstComment.generateFirstComments (injected deps)', () => {
  const deps = {
    sanitize: (t) => String(t).trim(),
    generate: async () => '["Q1?","Q2?","Q3?"]',
    assertBudget: async () => {},
    recordUsage: async () => {},
  };

  test('returns normalized goal + parsed options', async () => {
    const out = await generateFirstComments({ platform: 'youtube', goal: 'engagement', sourceText: 'hi' }, deps);
    expect(out).toMatchObject({ platform: 'youtube', goal: 'engagement' });
    expect(out.options).toHaveLength(3);
  });

  test('rejects empty source text with 400 before generating', async () => {
    let generated = false;
    const d = { ...deps, generate: async () => { generated = true; return '[]'; } };
    await expect(generateFirstComments({ platform: 'x', sourceText: '  ' }, d))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(generated).toBe(false);
  });
});

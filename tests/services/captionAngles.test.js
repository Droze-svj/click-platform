// Behavioral tests for the Caption Angles core (pure prompt/parse + injected AI).

const {
  ANGLE_KEYS,
  normalizeAngle,
  clampCount,
  anglesForCount,
  buildPrompt,
  shapeCaptions,
  generateCaptions,
} = require('../../server/services/captionAnglesService');

describe('captionAngles.normalizeAngle / clampCount', () => {
  test('unknown angle → hook; known angles pass', () => {
    expect(normalizeAngle('zzz')).toBe('hook');
    expect(normalizeAngle('story')).toBe('story');
    expect(normalizeAngle(undefined)).toBe('hook');
  });
  test('count clamps to 2–5, default 3', () => {
    expect(clampCount(1)).toBe(2);
    expect(clampCount(9)).toBe(5);
    expect(clampCount(4)).toBe(4);
    expect(clampCount('x')).toBe(3);
  });
});

describe('captionAngles.anglesForCount', () => {
  test('returns `count` distinct angles in order, cycling if needed', () => {
    expect(anglesForCount(3)).toEqual(ANGLE_KEYS.slice(0, 3));
    expect(anglesForCount(2)).toEqual(ANGLE_KEYS.slice(0, 2));
    // 5 keys exist, so no cycling at max.
    expect(anglesForCount(5)).toEqual(ANGLE_KEYS.slice(0, 5));
  });
});

describe('captionAngles.buildPrompt', () => {
  test('embeds platform, topic, and one numbered line per angle', () => {
    const p = buildPrompt({ platform: 'linkedin', topic: 'remote work', count: 3 });
    expect(p).toContain('linkedin');
    expect(p).toContain('remote work');
    expect(p).toContain('1. hook:');
    expect(p).toContain('2. story:');
    expect(p).toContain('3. value:');
    expect(p).toMatch(/JSON array of objects/);
  });
});

describe('captionAngles.shapeCaptions', () => {
  test('parses {angle,text} objects and dedupes by text', () => {
    const raw = JSON.stringify([
      { angle: 'hook', text: 'Hook cap' },
      { angle: 'story', text: 'hook cap' },  // dup text (case-insensitive)
      { angle: 'value', text: 'Value cap' },
    ]);
    expect(shapeCaptions(raw, 3)).toEqual([
      { angle: 'hook', text: 'Hook cap' },
      { angle: 'value', text: 'Value cap' },
    ]);
  });
  test('assigns angles in order for bare-string arrays', () => {
    const out = shapeCaptions(JSON.stringify(['A', 'B']), 3);
    expect(out).toEqual([
      { angle: 'hook', text: 'A' },
      { angle: 'story', text: 'B' },
    ]);
  });
  test('coerces an unknown angle to hook', () => {
    const out = shapeCaptions(JSON.stringify([{ angle: 'bogus', text: 'X' }]), 3);
    expect(out[0].angle).toBe('hook');
  });
  test('caps at the clamped count', () => {
    const raw = JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ angle: 'hook', text: `c${i}` })));
    expect(shapeCaptions(raw, 2)).toHaveLength(2);
    expect(shapeCaptions(raw, 1)).toHaveLength(2); // min clamp
  });
  test('falls back to line splitting; empty → []', () => {
    expect(shapeCaptions('1. First\n2) Second', 3).map((c) => c.text)).toEqual(['First', 'Second']);
    expect(shapeCaptions('', 3)).toEqual([]);
    expect(shapeCaptions(null, 3)).toEqual([]);
  });
});

describe('captionAngles.generateCaptions (injected deps, no AI/network)', () => {
  const baseDeps = () => {
    const calls = { assertBudget: 0, recordUsage: 0 };
    return {
      calls,
      sanitize: (t, cap) => String(t || '').slice(0, cap),
      generate: async () => JSON.stringify([
        { angle: 'hook', text: 'Hook one' },
        { angle: 'story', text: 'Story two' },
      ]),
      assertBudget: async () => { calls.assertBudget += 1; },
      recordUsage: async () => { calls.recordUsage += 1; },
    };
  };

  test('throws 400 when the topic is empty', async () => {
    await expect(generateCaptions({ platform: 'x', topic: '  ' }, baseDeps()))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('returns shaped captions and runs budget + usage accounting', async () => {
    const deps = baseDeps();
    const out = await generateCaptions({ platform: 'instagram', topic: 'coffee', count: 2 }, deps);
    expect(out.platform).toBe('instagram');
    expect(out.captions).toEqual([
      { angle: 'hook', text: 'Hook one' },
      { angle: 'story', text: 'Story two' },
    ]);
    expect(deps.calls.assertBudget).toBe(1);
    expect(deps.calls.recordUsage).toBe(1);
  });
});

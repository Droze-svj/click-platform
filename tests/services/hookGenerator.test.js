// Behavioral tests for the Hook Generator core (pure prompt/parse + injected AI).

const {
  STYLES,
  normalizeStyle,
  clampCount,
  buildPrompt,
  shapeHooks,
  generateHooks,
} = require('../../server/services/hookGeneratorService');

describe('hookGenerator.normalizeStyle / clampCount', () => {
  test('unknown style falls back to mix; known styles pass through', () => {
    expect(normalizeStyle('nope')).toBe('mix');
    expect(normalizeStyle('curiosity')).toBe('curiosity');
    expect(normalizeStyle(undefined)).toBe('mix');
  });
  test('count is clamped to 3–8 with a default of 5', () => {
    expect(clampCount(1)).toBe(3);
    expect(clampCount(99)).toBe(8);
    expect(clampCount(6)).toBe(6);
    expect(clampCount('abc')).toBe(5);
    expect(clampCount(undefined)).toBe(5);
  });
});

describe('hookGenerator.buildPrompt', () => {
  test('embeds platform, style guidance, topic, and the exact count', () => {
    const p = buildPrompt({ platform: 'tiktok', style: 'contrarian', topic: 'cold email', count: 4 });
    expect(p).toContain('tiktok');
    expect(p).toContain(STYLES.contrarian);
    expect(p).toContain('cold email');
    expect(p).toContain('exactly 4 distinct hooks');
    expect(p).toMatch(/JSON array of 4 strings/);
  });
  test('unknown style uses the mix guidance', () => {
    const p = buildPrompt({ platform: 'instagram', style: 'zzz', topic: 't', count: 5 });
    expect(p).toContain(STYLES.mix);
  });
});

describe('hookGenerator.shapeHooks', () => {
  test('parses a JSON array and dedupes case-insensitively', () => {
    const raw = JSON.stringify(['Hook one', 'hook one', 'Hook two', 'Hook three']);
    const out = shapeHooks(raw, 'curiosity', 5);
    expect(out).toEqual([
      { text: 'Hook one', style: 'curiosity' },
      { text: 'Hook two', style: 'curiosity' },
      { text: 'Hook three', style: 'curiosity' },
    ]);
  });
  test('caps at the (clamped) count — min 3', () => {
    const raw = JSON.stringify(['a', 'b', 'c', 'd', 'e']);
    // count 2 clamps up to 3.
    expect(shapeHooks(raw, 'mix', 2)).toHaveLength(3);
    // count 4 honored.
    expect(shapeHooks(raw, 'mix', 4)).toHaveLength(4);
  });
  test('extracts a JSON array embedded in prose', () => {
    const raw = 'Sure! Here you go:\n["A hook", "B hook"]\nHope that helps';
    const out = shapeHooks(raw, 'bold', 5);
    expect(out.map((h) => h.text)).toEqual(['A hook', 'B hook']);
  });
  test('falls back to line-splitting when there is no JSON', () => {
    const raw = '1. First hook\n2) Second hook\n- Third hook';
    const out = shapeHooks(raw, 'story', 5);
    expect(out.map((h) => h.text)).toEqual(['First hook', 'Second hook', 'Third hook']);
  });
  test('empty / null input yields no hooks', () => {
    expect(shapeHooks('', 'mix', 5)).toEqual([]);
    expect(shapeHooks(null, 'mix', 5)).toEqual([]);
  });
});

describe('hookGenerator.generateHooks (injected deps, no AI/network)', () => {
  const baseDeps = () => {
    const calls = { assertBudget: 0, recordUsage: 0 };
    return {
      calls,
      sanitize: (t, cap) => String(t || '').slice(0, cap),
      generate: async () => JSON.stringify(['Hook A', 'Hook B', 'Hook C']),
      assertBudget: async () => { calls.assertBudget += 1; },
      recordUsage: async () => { calls.recordUsage += 1; },
    };
  };

  test('throws 400 when the topic is empty', async () => {
    const deps = baseDeps();
    await expect(generateHooks({ platform: 'x', topic: '   ' }, deps))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('returns shaped hooks and runs budget + usage accounting', async () => {
    const deps = baseDeps();
    const out = await generateHooks({ platform: 'instagram', style: 'bold', topic: 'AI tools', count: 3 }, deps);
    expect(out.platform).toBe('instagram');
    expect(out.style).toBe('bold');
    expect(out.hooks).toHaveLength(3);
    expect(out.hooks[0]).toEqual({ text: 'Hook A', style: 'bold' });
    expect(deps.calls.assertBudget).toBe(1);
    expect(deps.calls.recordUsage).toBe(1);
  });

  test('normalizes an unknown style to mix in the result', async () => {
    const deps = baseDeps();
    const out = await generateHooks({ platform: 'x', style: 'bogus', topic: 'hi' }, deps);
    expect(out.style).toBe('mix');
  });

  test('prepends the personalized system prompt when buildSystemPrompt + userId are provided', async () => {
    const deps = baseDeps();
    let capturedPrompt = null;
    deps.generate = async (prompt) => { capturedPrompt = prompt; return JSON.stringify(['A', 'B', 'C']); };
    deps.buildSystemPrompt = jest.fn(async ({ userId, platform, stage }) =>
      `PERSONA[user=${userId},platform=${platform},stage=${stage}]`);

    await generateHooks({ platform: 'tiktok', style: 'bold', topic: 'x', count: 3, userId: 'user-123' }, deps);

    expect(deps.buildSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', platform: 'tiktok', stage: 'hook' })
    );
    // The creator's persona must ride in front of the task prompt sent to the model.
    expect(capturedPrompt).toContain('PERSONA[user=user-123,platform=tiktok,stage=hook]');
    expect(capturedPrompt).toContain('── Task ──');
    expect(capturedPrompt).toContain('scroll-stopping HOOKS');
  });

  test('falls back to the base prompt when buildSystemPrompt is absent (no userId leak)', async () => {
    const deps = baseDeps();
    let capturedPrompt = null;
    deps.generate = async (prompt) => { capturedPrompt = prompt; return JSON.stringify(['A', 'B', 'C']); };
    await generateHooks({ platform: 'tiktok', topic: 'x', count: 3, userId: 'user-123' }, deps);
    expect(capturedPrompt).not.toContain('── Task ──'); // no persona wrapper
    expect(capturedPrompt).toContain('scroll-stopping HOOKS');
  });
});

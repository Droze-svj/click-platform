// Behavioral tests for the Hashtag Strategist core (pure prompt/parse + injected AI).

const {
  TIER_KEYS,
  normalizeTier,
  clampCount,
  normalizeTag,
  buildPrompt,
  shapeTags,
  groupByTier,
  generateHashtags,
} = require('../../server/services/hashtagStrategistService');

describe('hashtagStrategist.normalizeTag', () => {
  test('canonicalizes to a single #token, stripping spaces/punctuation', () => {
    expect(normalizeTag('social media')).toBe('#socialmedia');
    expect(normalizeTag('##Growth!')).toBe('#Growth');
    expect(normalizeTag('  #cold_email  ')).toBe('#cold_email');
    expect(normalizeTag('#')).toBe('');
    expect(normalizeTag('   ')).toBe('');
    expect(normalizeTag(null)).toBe('');
  });
  test('keeps unicode letters and digits', () => {
    expect(normalizeTag('café2026')).toBe('#café2026');
  });
});

describe('hashtagStrategist.normalizeTier / clampCount', () => {
  test('unknown tier → niche; known tiers pass', () => {
    expect(normalizeTier('zzz')).toBe('niche');
    expect(normalizeTier('broad')).toBe('broad');
    expect(normalizeTier(undefined)).toBe('niche');
  });
  test('count clamps to 5–30, default 15', () => {
    expect(clampCount(1)).toBe(5);
    expect(clampCount(999)).toBe(30);
    expect(clampCount(12)).toBe(12);
    expect(clampCount('x')).toBe(15);
  });
});

describe('hashtagStrategist.buildPrompt', () => {
  test('embeds platform, topic, all tiers, and the exact count', () => {
    const p = buildPrompt({ platform: 'tiktok', topic: 'meal prep', count: 10 });
    expect(p).toContain('tiktok');
    expect(p).toContain('meal prep');
    for (const t of TIER_KEYS) expect(p).toContain(`${t}:`);
    expect(p).toContain('exactly 10 hashtags');
  });
});

describe('hashtagStrategist.shapeTags', () => {
  test('parses {tag,tier} objects, normalizes + dedupes case-insensitively', () => {
    const raw = JSON.stringify([
      { tag: '#Fitness', tier: 'broad' },
      { tag: 'fitness', tier: 'niche' },     // dup of #Fitness (case-insensitive)
      { tag: 'meal prep', tier: 'niche' },
      { tag: '#glutenfree', tier: 'community' },
    ]);
    const out = shapeTags(raw, 15);
    expect(out).toEqual([
      { tag: '#Fitness', tier: 'broad' },
      { tag: '#mealprep', tier: 'niche' },
      { tag: '#glutenfree', tier: 'community' },
    ]);
  });
  test('coerces an unknown tier to niche', () => {
    const out = shapeTags(JSON.stringify([{ tag: '#x', tier: 'bogus' }]), 15);
    expect(out[0].tier).toBe('niche');
  });
  test('caps at the clamped count', () => {
    const raw = JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ tag: `#t${i}`, tier: 'niche' })));
    expect(shapeTags(raw, 6)).toHaveLength(6);
    expect(shapeTags(raw, 1)).toHaveLength(5); // min clamp
  });
  test('extracts an array embedded in prose', () => {
    const raw = 'Here you go:\n[{"tag":"#a","tier":"broad"}]\ndone';
    expect(shapeTags(raw, 15).map((r) => r.tag)).toEqual(['#a']);
  });
  test('falls back to comma/line splitting of bare tags', () => {
    const out = shapeTags('#one, #two\n#three', 15);
    expect(out.map((r) => r.tag)).toEqual(['#one', '#two', '#three']);
    expect(out.every((r) => r.tier === 'niche')).toBe(true);
  });
  test('empty input → []', () => {
    expect(shapeTags('', 15)).toEqual([]);
    expect(shapeTags(null, 15)).toEqual([]);
  });
});

describe('hashtagStrategist.groupByTier', () => {
  test('buckets tags by tier and always includes every tier key', () => {
    const groups = groupByTier([
      { tag: '#a', tier: 'broad' }, { tag: '#b', tier: 'niche' }, { tag: '#c', tier: 'niche' },
    ]);
    expect(groups.broad).toEqual(['#a']);
    expect(groups.niche).toEqual(['#b', '#c']);
    expect(groups.community).toEqual([]);
    expect(groups.branded).toEqual([]);
    expect(Object.keys(groups).sort()).toEqual([...TIER_KEYS].sort());
  });
});

describe('hashtagStrategist.generateHashtags (injected deps, no AI/network)', () => {
  const baseDeps = () => {
    const calls = { assertBudget: 0, recordUsage: 0 };
    return {
      calls,
      sanitize: (t, cap) => String(t || '').slice(0, cap),
      generate: async () => JSON.stringify([
        { tag: '#reach', tier: 'broad' },
        { tag: '#targeted', tier: 'niche' },
        { tag: '#micro', tier: 'community' },
      ]),
      assertBudget: async () => { calls.assertBudget += 1; },
      recordUsage: async () => { calls.recordUsage += 1; },
    };
  };

  test('throws 400 when the topic is empty', async () => {
    await expect(generateHashtags({ platform: 'x', topic: '  ' }, baseDeps()))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('returns normalized tags + grouped view and runs accounting', async () => {
    const deps = baseDeps();
    const out = await generateHashtags({ platform: 'instagram', topic: 'running', count: 10 }, deps);
    expect(out.platform).toBe('instagram');
    expect(out.count).toBe(3);
    expect(out.tags.map((t) => t.tag)).toEqual(['#reach', '#targeted', '#micro']);
    expect(out.groups.broad).toEqual(['#reach']);
    expect(deps.calls.assertBudget).toBe(1);
    expect(deps.calls.recordUsage).toBe(1);
  });
});

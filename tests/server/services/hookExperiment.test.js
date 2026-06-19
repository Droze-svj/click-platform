const {
  HOOK_ANGLES, distributeSlots, evaluateHookExperiment, generateHookExperiment,
} = require('../../../server/services/hookExperimentService');

describe('distributeSlots (pure)', () => {
  it('staggers by spacingHours when no windows given', () => {
    const out = distributeSlots([{ angle: 'a' }, { angle: 'b' }, { angle: 'c' }], [], { spacingHours: 12 });
    expect(out.map((v) => v.slotOffsetHours)).toEqual([0, 12, 24]);
    expect(out.every((v) => v.scheduledWindow === null)).toBe(true);
  });

  it('uses supplied optimal windows in order', () => {
    const out = distributeSlots([{ angle: 'a' }, { angle: 'b' }], ['2026-06-20T18:00Z', '2026-06-21T18:00Z']);
    expect(out[0].scheduledWindow).toBe('2026-06-20T18:00Z');
    expect(out[1].slotOffsetHours).toBeNull();
  });
});

describe('evaluateHookExperiment (pure)', () => {
  it('picks the highest engagement-rate variant and computes lift', () => {
    const r = evaluateHookExperiment([
      { angle: 'curiosity', impressions: 1000, engagement: 100 }, // 10%
      { angle: 'authority', impressions: 1000, engagement: 80 },  // 8%
    ]);
    expect(r.winner.angle).toBe('curiosity');
    expect(r.lift).toBeCloseTo(25, 0); // (0.10-0.08)/0.08 = 25%
    expect(r.confident).toBe(true);
    expect(r.reason).toBe('significant');
  });

  it('is not confident below the impression floor', () => {
    const r = evaluateHookExperiment([
      { angle: 'a', impressions: 10, engagement: 5 },
      { angle: 'b', impressions: 10, engagement: 1 },
    ], { minImpressions: 100 });
    expect(r.confident).toBe(false);
    expect(r.reason).toBe('inconclusive');
  });

  it('handles <2 variants without throwing', () => {
    expect(evaluateHookExperiment([{ angle: 'a', impressions: 5, engagement: 1 }]).reason).toBe('insufficient_variants');
    expect(evaluateHookExperiment([]).winner).toBeNull();
  });
});

describe('generateHookExperiment (orchestrator + honest fallback)', () => {
  it('always returns one usable variant per angle (templates when AI is down)', async () => {
    const result = await generateHookExperiment('how to edit faster in capcut', { spacingHours: 8 });
    expect(result.variants).toHaveLength(HOOK_ANGLES.length);
    expect(result.variants.map((v) => v.angle).sort()).toEqual(['authority', 'curiosity', 'fomo']);
    // Each variant has a non-empty hook + a slot.
    for (const v of result.variants) {
      expect(typeof v.hook).toBe('string');
      expect(v.hook.length).toBeGreaterThan(0);
      expect(['ai', 'template']).toContain(v.source);
    }
    expect(result.variants.map((v) => v.slotOffsetHours)).toEqual([0, 8, 16].map((n, i) => (result.variants[i].scheduledWindow ? null : n)));
  });
});

// Unit tests for the retention→weighted-facets mapping — the CORE of the live
// learning loop (platformIngestionCron fetches analytics → ingestPostPerformance
// → these two pure fns → UserStyleProfile.recordPerformance). Verifying them
// protects the loop against regression without needing real platform analytics.

const { computeRetentionDelta, extractPicks } = require('../../../server/services/creatorPerformanceService');

// The model's recordPerformance allow-list — every facet extractPicks emits MUST
// be in here, or recordPerformance would throw at ingest time.
const PERF_FACETS = new Set([
  'weightedFonts', 'weightedCaptionStyles', 'weightedAnimations', 'weightedMotions',
  'weightedColorGrades', 'weightedTransitions', 'weightedHooks', 'weightedPacing',
  'weightedVoiceTones', 'weightedCtaCategories', 'weightedHashtags',
]);

describe('creatorPerformanceService.computeRetentionDelta', () => {
  it('is retention minus the (default 0.55) benchmark', () => {
    expect(computeRetentionDelta({ retentionRate: 0.75 })).toBeCloseTo(0.2);
    expect(computeRetentionDelta({ completionRate: 0.40 })).toBeCloseTo(-0.15); // falls back to completionRate
    expect(computeRetentionDelta({ retentionRate: 0.9, benchmarkRetention: 0.6 })).toBeCloseTo(0.3);
  });

  it('clamps to [-1, 1] and returns 0 when retention is unknown', () => {
    expect(computeRetentionDelta({ retentionRate: 5 })).toBe(1);
    expect(computeRetentionDelta({ retentionRate: -5 })).toBe(-1);
    expect(computeRetentionDelta({})).toBe(0);
    expect(computeRetentionDelta({ viewCount: 100 })).toBe(0); // no retention signal
  });

  it('derives retention from nested watchTime (the raw shape the 6h cron passes)', () => {
    // 80% avg watch → 0.80 - 0.55 benchmark = 0.25. This is the signal that
    // would have been LOST when the inline derivation was removed if the cron's
    // raw `post.analytics` (nested watchTime) produced a neutral 0.
    expect(computeRetentionDelta({ watchTime: { averagePercentage: 80 } })).toBeCloseTo(0.25);
    // flat fields take precedence over the nested fallback
    expect(computeRetentionDelta({ retentionRate: 0.6, watchTime: { averagePercentage: 99 } })).toBeCloseTo(0.05);
    // missing/garbage nested value → neutral 0, never NaN
    expect(computeRetentionDelta({ watchTime: {} })).toBe(0);
    expect(computeRetentionDelta({ watchTime: { averagePercentage: 'NaN' } })).toBe(0);
  });
});

describe('creatorPerformanceService.extractPicks', () => {
  it('maps overlays + metadata to the right weighted facets (deduped)', () => {
    const content = {
      textOverlays: [
        { fontFamily: 'Inter', style: 'bold-kinetic', animationIn: 'pop', motionGraphic: 'zoom' },
        { fontFamily: 'Inter' }, // duplicate font — must not double-count
      ],
      metadata: { colorGrade: 'cinematic', transitions: ['fade'], hookFrameworkId: 'curiosity-gap', avgCutDuration: 1.4 },
    };
    const picks = extractPicks(content);
    const has = (facet, key) => picks.some((p) => p.facet === facet && p.key === key);

    expect(has('weightedFonts', 'Inter')).toBe(true);
    expect(has('weightedCaptionStyles', 'bold-kinetic')).toBe(true);
    expect(has('weightedAnimations', 'pop')).toBe(true);
    expect(has('weightedMotions', 'zoom')).toBe(true);
    expect(has('weightedColorGrades', 'cinematic')).toBe(true);
    expect(has('weightedTransitions', 'fade')).toBe(true);
    expect(has('weightedHooks', 'curiosity-gap')).toBe(true);
    expect(has('weightedPacing', 'dynamic-kinetic')).toBe(true); // avgCut < 2 → dynamic
    // de-dup: only one Inter font pick
    expect(picks.filter((p) => p.facet === 'weightedFonts' && p.key === 'Inter')).toHaveLength(1);
  });

  it('detects pacing + voice tone heuristically', () => {
    expect(extractPicks({ metadata: { avgCutDuration: 3.5 } }).some((p) => p.facet === 'weightedPacing' && p.key === 'steady-breathing')).toBe(true);
    expect(extractPicks({ text: 'maximize your ROI and conversion yield' }).some((p) => p.facet === 'weightedVoiceTones' && p.key === 'growth-catalyst')).toBe(true);
  });

  it('only ever emits facets the model accepts (no throw-on-invalid at ingest)', () => {
    const picks = extractPicks({
      textOverlays: [{ fontFamily: 'Roboto', style: 's', animationIn: 'a', motionGraphic: 'm' }],
      metadata: { colorGrade: 'g', transitions: ['t1', 't2'], hookFrameworkId: 'h', hashtags: ['#x'], ctaCategory: 'save' },
      text: 'brutal truth, stop doing this',
    });
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) expect(PERF_FACETS.has(p.facet)).toBe(true);
  });
});

// Unit tests for the GET /api/me/personalization/recommendations shaper. The
// route itself is a cheap field-read of UserPreferences.marketingIntelligence;
// `shapeRecommendations` is the pure, cold-start-safe mapper, exported from the
// route module and tested here without a DB or HTTP server. (Lives outside
// tests/server/routes/ because that dir is reserved for full-HTTP route tests,
// which jest's `unit` project ignores.)

const { shapeRecommendations } = require('../../server/routes/me-personalization');

describe('shapeRecommendations', () => {
  test('cold-start: no marketingIntelligence → hasData:false, nulls, no throw', () => {
    for (const input of [undefined, null, {}, { activeCreativeBlueprint: null }, { activeCreativeBlueprint: {} }]) {
      const out = shapeRecommendations(input);
      expect(out.hasData).toBe(false);
      expect(out.blueprint).toBeNull();
      expect(out.performance).toBeNull();
      expect(out.lastSync).toBeNull();
    }
  });

  test('populated: maps the blueprint + performance and trims dirty array entries', () => {
    const out = shapeRecommendations({
      lastLearningSync: '2026-06-14T00:00:00.000Z',
      activeCreativeBlueprint: {
        recommendedColorMood: 'warm cinematic',
        pacingStrategy: 'punchy',
        captionStyle: 'bold-kinetic',
        recommendedVfx: ['zoom-punch', '', '  ', 'speed-ramp', 42, null],
        failingPatterns: ['slow intros'],
        suggestedPivot: 'Lead with the dollar figure.',
        contentSeriesWinners: ['IRA mistakes'],
        rationale: 'Fast, number-led finance breakdowns retained best.',
      },
      historicalPerformanceMetrics: { avgRetentionDelta: 0.18, sampleSize: 7, hasRealData: true },
    });

    expect(out.hasData).toBe(true);
    expect(out.lastSync).toBe('2026-06-14T00:00:00.000Z');
    expect(out.blueprint.recommendedColorMood).toBe('warm cinematic');
    expect(out.blueprint.pacingStrategy).toBe('punchy');
    // non-strings + blanks dropped, real entries kept in order
    expect(out.blueprint.recommendedVfx).toEqual(['zoom-punch', 'speed-ramp']);
    expect(out.blueprint.failingPatterns).toEqual(['slow intros']);
    expect(out.blueprint.suggestedPivot).toBe('Lead with the dollar figure.');
    expect(out.performance).toEqual({ avgRetentionDelta: 0.18, sampleSize: 7, hasRealData: true });
  });

  test('performance present but blueprint absent → hasData:false, performance still surfaced', () => {
    const out = shapeRecommendations({ historicalPerformanceMetrics: { avgRetentionDelta: 0.05, sampleSize: 3 } });
    expect(out.hasData).toBe(false);
    expect(out.blueprint).toBeNull();
    expect(out.performance).toEqual({ avgRetentionDelta: 0.05, sampleSize: 3, hasRealData: false });
  });

  test('coerces non-numeric performance fields to safe defaults', () => {
    const out = shapeRecommendations({
      activeCreativeBlueprint: { recommendedColorMood: 'x' },
      historicalPerformanceMetrics: { avgRetentionDelta: 'NaN', sampleSize: undefined, hasRealData: 1 },
    });
    expect(out.performance).toEqual({ avgRetentionDelta: 0, sampleSize: 0, hasRealData: true });
  });
});

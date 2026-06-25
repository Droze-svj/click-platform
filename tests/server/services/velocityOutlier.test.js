const {
  computeVelocity, velocityFromPublish, detectOutliers,
} = require('../../../server/services/velocityOutlierService');

const H = 3600000;

describe('computeVelocity (pure)', () => {
  it('computes views-per-hour and an accelerating trend', () => {
    const base = new Date('2026-06-20T00:00:00Z').getTime();
    const v = computeVelocity([
      { at: new Date(base).toISOString(), views: 0 },
      { at: new Date(base + 2 * H).toISOString(), views: 200 },     // 100/h
      { at: new Date(base + 3 * H).toISOString(), views: 500 },     // recent 300/h
    ]);
    expect(v.vph).toBe(Math.round(500 / 3)); // overall
    expect(v.recentVph).toBe(300);
    expect(v.trend).toBe('accelerating');
  });

  it('is flat with <2 points', () => {
    expect(computeVelocity([{ at: '2026-06-20T00:00:00Z', views: 10 }]).trend).toBe('flat');
    expect(computeVelocity([]).vph).toBe(0);
  });
});

describe('velocityFromPublish (pure)', () => {
  it('averages views over hours since publish', () => {
    const pub = new Date('2026-06-20T00:00:00Z').getTime();
    expect(velocityFromPublish(pub, 1000, pub + 10 * H)).toBe(100);
  });
  it('is 0 for a future/equal publish time', () => {
    const t = Date.parse('2026-06-20T00:00:00Z');
    expect(velocityFromPublish(t, 100, t)).toBe(0);
  });
});

describe('detectOutliers (pure)', () => {
  it('flags videos overperforming the creator median', () => {
    const videos = [
      { id: 'a', views: 100 }, { id: 'b', views: 120 }, { id: 'c', views: 110 },
      { id: 'd', views: 90 }, { id: 'viral', views: 1000 },
    ];
    const r = detectOutliers(videos, { metric: 'views', overMultiplier: 2 });
    expect(r.baseline).toBe(110);
    expect(r.outliers[0].id).toBe('viral');
    expect(r.outliers[0].multiplier).toBeCloseTo(1000 / 110, 1);
  });

  it('flags underperformers and needs >=3 videos', () => {
    const few = detectOutliers([{ views: 1 }, { views: 2 }]);
    expect(few.reason).toBe('insufficient_data');

    const r = detectOutliers([
      { id: 'a', views: 100 }, { id: 'b', views: 100 }, { id: 'c', views: 100 }, { id: 'dud', views: 10 },
    ], { underMultiplier: 0.4 });
    expect(r.underperformers.map((v) => v.id)).toContain('dud');
  });

  it('is safe on empty/malformed input', () => {
    expect(detectOutliers().reason).toBe('insufficient_data');
    expect(detectOutliers([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).reason).toBe('insufficient_data');
  });
});

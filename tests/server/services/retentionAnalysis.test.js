const { analyzeRetention } = require('../../../server/services/retentionAnalysisService');

describe('analyzeRetention (pure)', () => {
  it('detects a weak hook (big early drop)', () => {
    const r = analyzeRetention([
      { second: 0, percentage: 100 },
      { second: 3, percentage: 55 },   // 45% gone by 3s → weak hook
      { second: 10, percentage: 50 },
      { second: 20, percentage: 45 },
    ]);
    expect(r.hookScore).toBeLessThan(70);
    expect(r.recommendations.some((x) => x.type === 'hook')).toBe(true);
  });

  it('flags the steepest drop-off as a cut point', () => {
    const r = analyzeRetention([
      { second: 0, percentage: 100 },
      { second: 5, percentage: 95 },
      { second: 10, percentage: 92 },
      { second: 15, percentage: 60 },  // -32% → high-severity drop
      { second: 20, percentage: 58 },
    ]);
    expect(r.dropOffs[0].second).toBe(15);
    expect(r.dropOffs[0].severity).toBe('high');
    expect(r.recommendations.some((x) => x.type === 'cut' && x.second === 15)).toBe(true);
  });

  it('detects a rewatch peak (retention rises) as a lead/clip moment', () => {
    const r = analyzeRetention([
      { second: 0, percentage: 100 },
      { second: 10, percentage: 70 },
      { second: 12, percentage: 78 },  // +8 → rewatch
      { second: 20, percentage: 60 },
    ]);
    expect(r.rewatchPeaks[0].second).toBe(12);
    expect(r.recommendations.some((x) => x.type === 'lead')).toBe(true);
  });

  it('computes average view % and praises strong retention', () => {
    const r = analyzeRetention([
      { second: 0, percentage: 100 },
      { second: 10, percentage: 80 },
      { second: 20, percentage: 70 },
      { second: 30, percentage: 60 },
    ]);
    expect(r.avgViewPercent).toBe(78);
    expect(r.hookScore).toBeGreaterThanOrEqual(90);
    expect(r.recommendations.some((x) => x.type === 'strength')).toBe(true);
  });

  it('is safe on insufficient/empty data', () => {
    expect(analyzeRetention([]).reason).toBe('insufficient_data');
    expect(analyzeRetention([{ second: 0, percentage: 100 }]).reason).toBe('insufficient_data');
  });
});

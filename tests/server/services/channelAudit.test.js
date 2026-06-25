const { auditChannel } = require('../../../server/services/channelAuditService');

const D = 86400000;

function recentVideos(n, { thumb = true } = {}) {
  const base = new Date('2026-06-01T00:00:00Z').getTime();
  return Array.from({ length: n }, (_, i) => ({
    publishedAt: new Date(base + i * 2 * D).toISOString(), // every 2 days
    views: 1000, durationSec: 60, hasThumbnail: thumb,
  }));
}

describe('auditChannel (pure)', () => {
  it('grades a healthy channel highly', () => {
    const a = auditChannel({
      subscriberCount: 50000,
      metrics: { views: 100000, likes: 4000, comments: 1000, subscribersGained: 500, averageViewDuration: 40 },
      videos: recentVideos(8),
    });
    expect(a.score).toBeGreaterThanOrEqual(75);
    expect(['A', 'B']).toContain(a.grade);
    expect(a.subscores.engagement).toBeGreaterThan(80);
  });

  it('penalizes low engagement, weak retention, no growth + surfaces fixes', () => {
    const a = auditChannel({
      subscriberCount: 1000,
      metrics: { views: 100000, likes: 200, comments: 50, subscribersGained: 0, averageViewDuration: 10 },
      videos: recentVideos(8, { thumb: false }).map((v) => ({ ...v, durationSec: 120 })),
    });
    expect(a.score).toBeLessThan(60);
    const areas = a.issues.map((i) => i.area);
    expect(areas).toEqual(expect.arrayContaining(['engagement', 'retention', 'growth', 'metadata']));
  });

  it('flags irregular cadence', () => {
    const sparse = [
      { publishedAt: '2026-01-01T00:00:00Z', views: 100, durationSec: 60, hasThumbnail: true },
      { publishedAt: '2026-06-01T00:00:00Z', views: 100, durationSec: 60, hasThumbnail: true },
      { publishedAt: '2026-06-10T00:00:00Z', views: 100, durationSec: 60, hasThumbnail: true },
    ];
    const a = auditChannel({ subscriberCount: 10, metrics: {}, videos: sparse });
    expect(a.issues.some((i) => i.area === 'cadence')).toBe(true);
  });

  it('is safe on empty input', () => {
    const a = auditChannel();
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.grade).toBeTruthy();
  });
});

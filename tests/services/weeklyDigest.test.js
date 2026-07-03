// Behavioral tests for the Weekly Performance Digest pure builder (no DB/AI).

const { buildDigest, floorToDay } = require('../../server/services/weeklyDigestService');

const periodEnd = Date.parse('2026-01-08T00:00:00Z');
const periodStart = periodEnd - 7 * 24 * 3600 * 1000;

const thisWeek = {
  totalEngagement: 1000,
  totalReach: 10000,
  averageEngagementRate: 10, // %
  topPerformingContent: [
    { id: 'a', platform: 'tiktok', engagement: 600, reach: 5000, postedAt: new Date(periodStart) },
    { id: 'b', platform: 'tiktok', engagement: 300, reach: 3000, postedAt: new Date(periodStart) },
    { id: 'c', platform: 'youtube', engagement: 100, reach: 2000, postedAt: new Date(periodStart) },
  ],
};

describe('weeklyDigest.buildDigest', () => {
  test('wins are the top posts, capped at 5', () => {
    const d = buildDigest({ periodStart, periodEnd, thisWeek, priorWeek: {}, nextBest: {} });
    expect(d.wins).toHaveLength(3);
    expect(d.wins[0]).toMatchObject({ id: 'a', platform: 'tiktok', engagement: 600 });
  });

  test('platformTrends groups by platform and sorts by engagement', () => {
    const d = buildDigest({ periodStart, periodEnd, thisWeek, priorWeek: {}, nextBest: {} });
    expect(d.platformTrends[0]).toEqual({ platform: 'tiktok', posts: 2, engagement: 900 });
    expect(d.platformTrends[1]).toEqual({ platform: 'youtube', posts: 1, engagement: 100 });
  });

  test("trend is 'new' with no prior week", () => {
    const d = buildDigest({ periodStart, periodEnd, thisWeek, priorWeek: { averageEngagementRate: 0 }, nextBest: {} });
    expect(d.summary.trend).toBe('new');
    expect(d.summary.changePct).toBeNull();
  });

  test("trend 'up' / 'down' / 'stable' vs prior rate with changePct", () => {
    const up = buildDigest({ periodStart, periodEnd, thisWeek, priorWeek: { averageEngagementRate: 5 }, nextBest: {} });
    expect(up.summary.trend).toBe('up');
    expect(up.summary.changePct).toBe(100); // 10 vs 5

    const down = buildDigest({ periodStart, periodEnd, thisWeek, priorWeek: { averageEngagementRate: 20 }, nextBest: {} });
    expect(down.summary.trend).toBe('down');

    const stable = buildDigest({ periodStart, periodEnd, thisWeek, priorWeek: { averageEngagementRate: 10 }, nextBest: {} });
    expect(stable.summary.trend).toBe('stable');
  });

  test('nextActions use real next-best ideas when present, else a baseline', () => {
    const withIdeas = buildDigest({
      periodStart, periodEnd, thisWeek, priorWeek: {},
      nextBest: { hasRealData: true, ideas: [{ title: 'Do a duet', why: 'duets over-index for you' }] },
    });
    expect(withIdeas.nextActions[0]).toEqual({ source: 'next-best', title: 'Do a duet', detail: 'duets over-index for you' });

    const noData = buildDigest({ periodStart, periodEnd, thisWeek, priorWeek: {}, nextBest: { hasRealData: false } });
    expect(noData.nextActions[0].source).toBe('baseline');
  });

  test('hasData false when there is no engagement and no posts', () => {
    const empty = buildDigest({ periodStart, periodEnd, thisWeek: {}, priorWeek: {}, nextBest: {} });
    expect(empty.hasData).toBe(false);
    expect(empty.wins).toHaveLength(0);
    expect(empty.summary.postCount).toBe(0);
  });

  test('floorToDay normalizes to UTC midnight (stable weekly period key)', () => {
    const noon = Date.parse('2026-01-08T12:34:56Z');
    expect(floorToDay(noon)).toBe(Date.parse('2026-01-08T00:00:00Z'));
  });
});

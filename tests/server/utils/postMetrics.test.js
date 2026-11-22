const { postMetrics } = require('../../../server/utils/postMetrics');

describe('postMetrics', () => {
  it('reads views from an X/Twitter sync (impressions, no views field)', () => {
    const m = postMetrics({
      impressions: 4218,
      engagement: 387,
      engagementBreakdown: { likes: 312, comments: 28, shares: 47, retweets: 47 },
    });
    expect(m.views).toBe(4218);
    expect(m).toMatchObject({ likes: 312, comments: 28, shares: 47 });
    expect(m.engagementRate).toBe(9.17);
  });

  it('prefers top-level numbers written by video-platform sync and manual results', () => {
    expect(postMetrics({ views: 1200, likes: 85, comments: 12, shares: 9, saves: 14 })).toEqual({
      views: 1200, likes: 85, comments: 12, shares: 9, saves: 14, engagementRate: 8.83,
    });
  });

  it('never invents views from the engagement count', () => {
    expect(postMetrics({ engagement: 387, engagementBreakdown: { likes: 300 } }).views).toBe(0);
    expect(postMetrics(undefined)).toMatchObject({ views: 0, engagementRate: 0 });
  });
});

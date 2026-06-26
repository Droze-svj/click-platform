// Personalized optimal posting time (B3). The service already aggregates the
// creator's OWN per-post engagement by hour/day; these tests lock in the new
// honest niche-default fallback: a thin/cold creator still gets a sensible slot,
// but it's clearly labeled source:'niche-default' (meanEngagement null) — never
// presented as their measured personal best — while a creator with real history
// gets source:'your-history'.

jest.mock('../../server/models/ScheduledPost', () => ({ find: jest.fn() }));
jest.mock('../../server/models/User', () => ({ findById: jest.fn() }));

const ScheduledPost = require('../../server/models/ScheduledPost');
const User = require('../../server/models/User');
const { getOptimalPostingWindows } = require('../../server/services/optimalPostingTimeService');

function mockPosts(posts) {
  ScheduledPost.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(posts) }) });
}
function mockNiche(niche) {
  User.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(niche ? { niche } : null) }) });
}

describe('getOptimalPostingWindows — personalized + honest niche fallback', () => {
  beforeEach(() => { ScheduledPost.find.mockReset(); User.findById.mockReset(); });

  it('cold creator → honest niche-default fallback (clearly labeled, no fake engagement)', async () => {
    mockPosts([]);
    mockNiche('finance');

    const r = await getOptimalPostingWindows('6a3500000000000000000aaa', { timezone: null });
    expect(r.confident).toBe(false);          // no REAL data behind it
    expect(r.usedFallback).toBe(true);
    expect(r.niche).toBe('finance');
    // Every cold-start platform gets a labeled generic window, not silence.
    const tiktok = r.windows.tiktok;
    expect(Array.isArray(tiktok) && tiktok.length).toBeTruthy();
    expect(r.source.tiktok).toBe('niche-default');
    expect(tiktok.every((w) => w.source === 'niche-default')).toBe(true);
    expect(tiktok.every((w) => w.meanEngagement === null)).toBe(true);   // honesty: no fabricated metric
    expect(typeof r.nextSuggested.tiktok).toBe('string');               // still actionable
  });

  it('creator with real history → personalized windows from their OWN posts', async () => {
    const when = new Date('2025-03-10T14:00:00Z'); // a Monday, hour 14 UTC
    const posts = Array.from({ length: 8 }, () => ({
      platform: 'tiktok', postedAt: when, analytics: { engagement: 10, reach: 100 },
    }));
    mockPosts(posts);
    mockNiche('finance');

    const r = await getOptimalPostingWindows('6a3500000000000000000bbb', { platform: 'tiktok' });
    expect(r.confident).toBe(true);
    expect(r.source.tiktok).toBe('your-history');
    const w = r.windows.tiktok;
    expect(w.length).toBeGreaterThan(0);
    expect(w[0].source).toBe('your-history');
    expect(w[0].sampleSize).toBe(8);
    expect(typeof w[0].meanEngagement).toBe('number');  // a REAL measured rate
  });

  it('includeNicheFallback:false keeps the strict legacy behavior (empty, source none)', async () => {
    mockPosts([]);
    const r = await getOptimalPostingWindows('6a3500000000000000000ccc', { platform: 'tiktok', includeNicheFallback: false });
    expect(r.confident).toBe(false);
    expect(r.usedFallback).toBe(false);
    expect(r.windows.tiktok).toEqual([]);
    expect(r.source.tiktok).toBe('none');
    expect(User.findById).not.toHaveBeenCalled();       // no niche lookup when fallback is off
  });
});

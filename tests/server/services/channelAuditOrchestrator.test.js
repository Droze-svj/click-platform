jest.mock('../../../server/services/youtubeAnalyticsService');
// Bypass the cache so each assertion runs the orchestrator deterministically.
jest.mock('../../../server/utils/cache', () => ({ wrap: (_key, fn) => fn() }));

const yt = require('../../../server/services/youtubeAnalyticsService');
const { getChannelAudit } = require('../../../server/services/channelAuditService');

describe('getChannelAudit (orchestrator)', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns honest available:false when the account is NOT connected (no fake F-grade)', async () => {
    yt.getChannelMetrics.mockResolvedValue({ connected: false, reason: 'google_not_connected' });
    const r = await getChannelAudit('u1', { days: 28 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('google_not_connected');
    expect(r.grade).toBeUndefined(); // did NOT fabricate an F-grade audit
    expect(yt.getTopVideos).not.toHaveBeenCalled();
  });

  it('threads accountId through to BOTH YouTube calls (multi-account accuracy)', async () => {
    yt.getChannelMetrics.mockResolvedValue({
      connected: true, subscriberCount: 1000,
      metrics: { views: 10000, likes: 400, comments: 100, subscribersGained: 50, averageViewDuration: 30 },
    });
    yt.getTopVideos.mockResolvedValue({
      connected: true,
      videos: [{ publishedAt: '2026-06-01T00:00:00Z', views: 1000, durationSec: 60, hasThumbnail: true }],
    });
    const r = await getChannelAudit('u1', { days: 28, accountId: 'acc-2' });

    expect(yt.getChannelMetrics).toHaveBeenCalledWith('u1', { days: 28, accountId: 'acc-2' });
    expect(yt.getTopVideos).toHaveBeenCalledWith('u1', expect.objectContaining({ accountId: 'acc-2' }));
    expect(r.available).toBe(true);
    expect(r.accountId).toBe('acc-2');
    // C2: retention subscore now reflects real durationSec (not a frozen 50 placeholder)
    expect(r.subscores.retention).toBeGreaterThan(0);
    expect(r.subscores.metadata).toBe(100); // hasThumbnail true on all videos
  });

  it('surfaces a channel error honestly', async () => {
    yt.getChannelMetrics.mockResolvedValue({ connected: true, error: 'quota exceeded' });
    const r = await getChannelAudit('u1', {});
    expect(r.available).toBe(false);
    expect(r.reason).toBe('channel_error');
  });
});

describe('parseIso8601Duration', () => {
  // Re-require the REAL module (the describe above mocked it).
  const real = jest.requireActual('../../../server/services/youtubeAnalyticsService');
  it('parses common YouTube durations to seconds', () => {
    expect(real.parseIso8601Duration('PT1M30S')).toBe(90);
    expect(real.parseIso8601Duration('PT45S')).toBe(45);
    expect(real.parseIso8601Duration('PT1H2M3S')).toBe(3723);
    expect(real.parseIso8601Duration('PT0S')).toBe(0);
  });
  it('is 0 on absent/garbage', () => {
    expect(real.parseIso8601Duration(undefined)).toBe(0);
    expect(real.parseIso8601Duration('nonsense')).toBe(0);
  });
});

describe('mapRetentionCurve', () => {
  const real = jest.requireActual('../../../server/services/youtubeAnalyticsService');
  it('maps YouTube ratio points to { second, percentage } using duration', () => {
    const out = real.mapRetentionCurve([
      { elapsedRatio: 0, audienceWatchRatio: 1 },
      { elapsedRatio: 0.5, audienceWatchRatio: 0.7 },
      { elapsedRatio: 1, audienceWatchRatio: 0.4 },
    ], 60);
    expect(out).toEqual([
      { second: 0, percentage: 100 },
      { second: 30, percentage: 70 },
      { second: 60, percentage: 40 },
    ]);
  });
  it('returns [] when duration is unknown (can\'t place a ratio in time)', () => {
    expect(real.mapRetentionCurve([{ elapsedRatio: 0.5, audienceWatchRatio: 0.8 }], 0)).toEqual([]);
    expect(real.mapRetentionCurve(null, 60)).toEqual([]);
  });
});

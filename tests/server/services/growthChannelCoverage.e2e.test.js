// Verifies the Growth layer covers the WHOLE channel (external videos), not just
// Click-published content, via the SocialVideo store.

jest.mock('../../../server/services/youtubeAnalyticsService', () => ({
  getMappedVideoRetention: jest.fn(),
}));

const mongoose = require('mongoose');
const SocialVideo = require('../../../server/models/SocialVideo');
const yt = require('../../../server/services/youtubeAnalyticsService');
const { getOutliers } = require('../../../server/services/velocityOutlierService');
const { getExternalVideoRetention } = require('../../../server/services/retentionAnalysisService');

const uidA = '6d1000000000000000000aaa';
const uidB = '6d1000000000000000000bbb';

async function makeSV(userId, externalId, views, { publishedAt } = {}) {
  return SocialVideo.create({
    userId: String(userId), platform: 'youtube', externalId,
    views, durationSec: 60, source: 'import',
    publishedAt: publishedAt || new Date('2026-06-01T00:00:00Z'),
  });
}

afterEach(async () => {
  await SocialVideo.deleteMany({});
  jest.clearAllMocks();
});

describe('getOutliers from the synced channel (covers external videos)', () => {
  it('detects an overperformer among ALL the channel\'s videos (source: channel)', async () => {
    await makeSV(uidA, 'a', 100);
    await makeSV(uidA, 'b', 120);
    await makeSV(uidA, 'c', 110);
    await makeSV(uidA, 'viral', 1500); // external upload that went viral
    const r = await getOutliers(uidA, { nowMs: Date.now(), overMultiplier: 2 });
    expect(r.source).toBe('channel');
    expect(r.available).toBe(true);
    expect(r.outliers[0].externalId).toBe('viral');
  });

  it('does not mix another user\'s channel into the baseline', async () => {
    await makeSV(uidA, 'a', 100);
    await makeSV(uidA, 'b', 100);
    await makeSV(uidA, 'c', 100);
    await makeSV(uidB, 'other', 999999);
    const r = await getOutliers(uidA, { nowMs: Date.now() });
    const ids = r.outliers.concat(r.underperformers).map((o) => o.externalId);
    expect(ids).not.toContain('other');
    expect(r.count).toBe(3);
  });
});

describe('getExternalVideoRetention (external video, ownership via SocialVideo)', () => {
  it('returns live retention for a synced external video', async () => {
    await makeSV(uidA, 'vEXT', 5000);
    yt.getMappedVideoRetention.mockResolvedValue({
      connected: true, durationSec: 60,
      curve: [{ second: 0, percentage: 100 }, { second: 3, percentage: 55 }, { second: 30, percentage: 50 }],
    });
    const r = await getExternalVideoRetention('vEXT', uidA, { accountId: 'acc-1' });
    expect(r.available).toBe(true);
    expect(r.source).toBe('youtube_live');
    expect(r.hookScore).toBeLessThan(70);
    expect(yt.getMappedVideoRetention).toHaveBeenCalledWith(String(uidA), 'vEXT', { accountId: 'acc-1' });
  });

  it('blocks a video the user does not own (IDOR)', async () => {
    await makeSV(uidA, 'vEXT', 5000);
    const r = await getExternalVideoRetention('vEXT', uidB, {});
    expect(r.available).toBe(false);
    expect(r.reason).toBe('not_found');
    expect(yt.getMappedVideoRetention).not.toHaveBeenCalled();
  });

  it('is honest when no retention is available yet', async () => {
    await makeSV(uidA, 'vEXT', 5000);
    yt.getMappedVideoRetention.mockResolvedValue({ connected: true, durationSec: 0, curve: [] });
    const r = await getExternalVideoRetention('vEXT', uidA, {});
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_retention');
  });
});

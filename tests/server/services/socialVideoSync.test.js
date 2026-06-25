jest.mock('../../../server/services/youtubeAnalyticsService', () => ({
  getTopVideos: jest.fn(),
}));

const mongoose = require('mongoose');
const SocialVideo = require('../../../server/models/SocialVideo');
const ScheduledPost = require('../../../server/models/ScheduledPost');
const yt = require('../../../server/services/youtubeAnalyticsService');
const { buildVideoRecord, syncYouTubeVideos, listVideos } = require('../../../server/services/socialVideoSyncService');

const uid = '6c1000000000000000000aaa';

afterEach(async () => {
  await Promise.all([SocialVideo.deleteMany({}), ScheduledPost.deleteMany({})]);
  jest.clearAllMocks();
});

describe('buildVideoRecord (pure)', () => {
  it('maps a getTopVideos item to an upsert payload', () => {
    const rec = buildVideoRecord(
      { videoId: 'v1', title: 'Hi', thumbnail: 't', hasThumbnail: true, durationSec: 60, publishedAt: '2026-06-01T00:00:00Z', views: 1000, likes: 50 },
      { userId: uid, accountId: 'acc-1', platform: 'youtube' },
    );
    expect(rec.externalId).toBe('v1');
    expect(rec.views).toBe(1000);
    expect(rec.hasThumbnail).toBe(true);
    expect(rec.publishedAt).toBeInstanceOf(Date);
  });
});

describe('syncYouTubeVideos (E2E)', () => {
  it('imports external videos and links Click-published ones', async () => {
    const clickContentId = new mongoose.Types.ObjectId();
    await ScheduledPost.create({
      userId: uid, contentId: clickContentId, platform: 'youtube',
      platformPostId: 'vCLICK', scheduledTime: new Date(), status: 'posted',
    });
    yt.getTopVideos.mockResolvedValue({
      connected: true,
      videos: [
        { videoId: 'vCLICK', title: 'From Click', views: 500, durationSec: 60, hasThumbnail: true, publishedAt: '2026-06-01T00:00:00Z' },
        { videoId: 'vEXT', title: 'External upload', views: 9000, durationSec: 120, hasThumbnail: true, publishedAt: '2026-05-01T00:00:00Z' },
      ],
    });

    const r = await syncYouTubeVideos(uid, { accountId: 'acc-1' });
    expect(r.available).toBe(true);
    expect(r.synced).toBe(2);

    const all = await SocialVideo.find({ userId: uid }).lean();
    expect(all).toHaveLength(2);
    const click = all.find((v) => v.externalId === 'vCLICK');
    const ext = all.find((v) => v.externalId === 'vEXT');
    expect(click.source).toBe('click');
    expect(String(click.contentId)).toBe(String(clickContentId));
    expect(ext.source).toBe('import'); // external video, no Click link
    expect(ext.contentId).toBeNull();
  });

  it('upserts idempotently (re-sync updates views, no duplicates)', async () => {
    yt.getTopVideos.mockResolvedValue({ connected: true, videos: [{ videoId: 'vX', views: 100, durationSec: 30 }] });
    await syncYouTubeVideos(uid, {});
    yt.getTopVideos.mockResolvedValue({ connected: true, videos: [{ videoId: 'vX', views: 250, durationSec: 30 }] });
    await syncYouTubeVideos(uid, {});
    const docs = await SocialVideo.find({ userId: uid, externalId: 'vX' }).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].views).toBe(250);
  });

  it('is honest when the account is not connected', async () => {
    yt.getTopVideos.mockResolvedValue({ connected: false, reason: 'google_not_connected', videos: [] });
    const r = await syncYouTubeVideos(uid, {});
    expect(r.available).toBe(false);
    expect(r.synced).toBe(0);
  });

  it('listVideos returns the user\'s synced videos sorted by views', async () => {
    yt.getTopVideos.mockResolvedValue({
      connected: true,
      videos: [{ videoId: 'a', views: 10, durationSec: 30 }, { videoId: 'b', views: 9000, durationSec: 30 }],
    });
    await syncYouTubeVideos(uid, {});
    const list = await listVideos(uid, {});
    expect(list.total).toBe(2);
    expect(list.videos[0].externalId).toBe('b'); // highest views first
  });
});

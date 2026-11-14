// TikTok post analytics (platformAnalyticsService.syncTikTokAnalytics).
//
// Direct Post hands back a publish_id, not a video id, and that publish_id is
// what got stored as ScheduledPost.platformPostId — so the old lookup in
// /v2/video/list/ never matched and no TikTok post ever had analytics. The sync
// now resolves the video id via /v2/post/publish/status/fetch/, persists it,
// and reads the counts from /v2/video/query/ (filters.video_ids).
// All TikTok HTTP is mocked; the DB is the in-memory Mongo from tests/setup.js.

jest.mock('../../../server/services/tokenRefreshService', () => ({
  getValidAccessToken: jest.fn().mockResolvedValue('test-token'),
}));
const mockPost = jest.fn();
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  const post = (...a) => mockPost(...a);
  return { ...actual, post, get: jest.fn(), put: jest.fn(), create: () => ({ post, get: jest.fn() }) };
});

const ScheduledPost = require('../../../server/models/ScheduledPost');
const { syncTikTokAnalytics, syncPostAnalytics } = require('../../../server/services/platformAnalyticsService');

const STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
const QUERY_URL_PREFIX = 'https://open.tiktokapis.com/v2/video/query/';
const PUBLISH_ID = 'v_pub_file~v2-1.7311111111111111111';
const VIDEO_ID = '7296688264532561153'; // > Number.MAX_SAFE_INTEGER

let statusRaw;
let queryVideos;

beforeEach(() => {
  statusRaw = `{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[${VIDEO_ID}]},"error":{"code":"ok","message":""}}`;
  queryVideos = [{ id: VIDEO_ID, view_count: 1200, like_count: 80, comment_count: 9, share_count: 3 }];
  mockPost.mockReset().mockImplementation(async (url) => {
    if (url === STATUS_URL) return { data: statusRaw };
    if (url.startsWith(QUERY_URL_PREFIX)) return { data: { data: { videos: queryVideos }, error: { code: 'ok' } } };
    throw new Error(`unexpected POST ${url}`);
  });
});

const makePost = (fields) => ScheduledPost.create({
  userId: 'tt-user', platform: 'tiktok', status: 'posted', scheduledTime: new Date(), postedAt: new Date(), ...fields,
});
const callsTo = (pred) => mockPost.mock.calls.filter((c) => pred(c[0]));

describe('syncTikTokAnalytics', () => {
  it('stored publish_id → status/fetch → persists the video id → reads counts via video/query', async () => {
    const post = await makePost({ platformPostId: PUBLISH_ID });

    const a = await syncTikTokAnalytics('tt-user', post._id, PUBLISH_ID);

    expect(callsTo((u) => u === STATUS_URL)[0][1]).toEqual({ publish_id: PUBLISH_ID });
    const q = callsTo((u) => u.startsWith(QUERY_URL_PREFIX))[0];
    expect(q[0]).toBe('https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count');
    expect(q[1]).toEqual({ filters: { video_ids: [VIDEO_ID] } });
    expect(callsTo((u) => u.includes('/video/list/'))).toHaveLength(0);

    expect(a).toMatchObject({
      views: 1200, likes: 80, comments: 9, shares: 3, engagement: 92,
      impressions: 1200, reach: 1200,
      engagementBreakdown: { likes: 80, comments: 9, shares: 3 },
    });
    expect(a.syncedAt).toBeInstanceOf(Date);

    const saved = await ScheduledPost.findById(post._id).lean();
    expect(saved.platformPostId).toBe(VIDEO_ID); // exact, not float-rounded
    expect(saved.metadata).toMatchObject({ tiktokPublishId: PUBLISH_ID, tiktokVideoId: VIDEO_ID, tiktokPublishStatus: 'PUBLISH_COMPLETE' });
  });

  it('metadata.tiktokPublishId + a non-id platformPostId → resolves from the metadata publish_id', async () => {
    const post = await makePost({ platformPostId: 'post-1731500000000', metadata: { tiktokPublishId: PUBLISH_ID, source: 'scheduler' } });
    const a = await syncTikTokAnalytics('tt-user', post._id, 'post-1731500000000');
    expect(a.views).toBe(1200);
    const saved = await ScheduledPost.findById(post._id).lean();
    expect(saved.platformPostId).toBe(VIDEO_ID);
    expect(saved.metadata.source).toBe('scheduler'); // existing metadata kept
  });

  it('already a video id → no status call, straight to video/query', async () => {
    const post = await makePost({ platformPostId: VIDEO_ID });
    const a = await syncTikTokAnalytics('tt-user', post._id, VIDEO_ID);
    expect(callsTo((u) => u === STATUS_URL)).toHaveLength(0);
    expect(a.likes).toBe(80);
  });

  it('no public video id yet (SELF_ONLY / processing) → null, publish status recorded', async () => {
    statusRaw = '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[]},"error":{"code":"ok"}}';
    const post = await makePost({ platformPostId: PUBLISH_ID });

    expect(await syncTikTokAnalytics('tt-user', post._id, PUBLISH_ID)).toBeNull();
    expect(callsTo((u) => u.startsWith(QUERY_URL_PREFIX))).toHaveLength(0);
    const saved = await ScheduledPost.findById(post._id).lean();
    expect(saved.platformPostId).toBe(PUBLISH_ID);
    expect(saved.metadata.tiktokPublishStatus).toBe('PUBLISH_COMPLETE');

    // A just-checked private post is not re-asked every tick.
    mockPost.mockClear();
    expect(await syncTikTokAnalytics('tt-user', post._id, PUBLISH_ID)).toBeNull();
    expect(callsTo((u) => u === STATUS_URL)).toHaveLength(0);
  });

  it('TikTok FAILED the post → null and never asked again', async () => {
    statusRaw = '{"data":{"status":"FAILED","fail_reason":"spam_risk_too_many_posts"},"error":{"code":"ok"}}';
    const post = await makePost({ platformPostId: PUBLISH_ID });
    expect(await syncTikTokAnalytics('tt-user', post._id, PUBLISH_ID)).toBeNull();
    mockPost.mockClear();
    expect(await syncTikTokAnalytics('tt-user', post._id, PUBLISH_ID)).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('video/query error (e.g. missing video.list scope) → null, NOT a zero snapshot', async () => {
    const post = await makePost({ platformPostId: VIDEO_ID });
    mockPost.mockImplementation(async () => {
      const e = new Error('Request failed with status code 403');
      e.response = { status: 403, data: { error: { code: 'scope_not_authorized', message: 'video.list' } } };
      throw e;
    });
    expect(await syncTikTokAnalytics('tt-user', post._id, VIDEO_ID)).toBeNull();
  });

  it('401 propagates (token refresh / reconnect handling)', async () => {
    const post = await makePost({ platformPostId: VIDEO_ID });
    mockPost.mockImplementation(async () => {
      const e = new Error('Request failed with status code 401');
      e.response = { status: 401, data: { error: { code: 'access_token_invalid' } } };
      throw e;
    });
    await expect(syncTikTokAnalytics('tt-user', post._id, VIDEO_ID)).rejects.toThrow(/401/);
  });

  it('end to end through syncPostAnalytics: publish_id post gets real numbers saved', async () => {
    const post = await makePost({ platformPostId: PUBLISH_ID, analytics: { views: 0 } });
    await syncPostAnalytics('tt-user', post._id);
    const saved = await ScheduledPost.findById(post._id).lean();
    expect(saved.platformPostId).toBe(VIDEO_ID);
    expect(saved.analytics).toMatchObject({ views: 1200, likes: 80, comments: 9, shares: 3 });
    expect(saved.lastAnalyticsSync).toBeInstanceOf(Date);
  });

  it('transient failure keeps the previously synced numbers', async () => {
    const post = await makePost({ platformPostId: VIDEO_ID });
    await syncPostAnalytics('tt-user', post._id);
    mockPost.mockRejectedValue(new Error('socket hang up'));
    expect(await syncPostAnalytics('tt-user', post._id)).toBeNull();
    const saved = await ScheduledPost.findById(post._id).lean();
    expect(saved.analytics.views).toBe(1200);
  });
});

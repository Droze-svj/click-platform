// POST /api/post-results — a creator logs how a published video did, and the
// learning loop actually learns from it. Real router + real models on the
// in-memory DB owned by tests/setup.js (mocks hid every earlier loop bug).

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const ScheduledPost = require('../../../server/models/ScheduledPost');
const UserStyleProfile = require('../../../server/models/UserStyleProfile');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { runLearningTick } = require('../../../server/services/performanceLearningCron');

const sign = (u) => jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });

describe('/api/post-results', () => {
  let user; let other; let token; let otherToken; let video; let otherVideo;
  const as = (t) => (r) => r.set('Authorization', `Bearer ${t}`);
  const post = (t, body) => as(t)(request(app).post('/api/post-results').send(body));

  beforeAll(async () => {
    // tests/setup.js connects Mongoose directly, so the config's health flag stays
    // false; resolveContent (used by the ownership guard) needs it on, as in prod.
    jest.spyOn(require('../../../server/config/database'), 'getDatabaseHealth').mockReturnValue({ status: 'connected', mongodb: true });
    await User.deleteMany({ email: { $in: ['pr-a@example.com', 'pr-b@example.com'] } });
    user = await new User({ email: 'pr-a@example.com', password: 'password123', name: 'A', emailVerified: true }).save();
    other = await new User({ email: 'pr-b@example.com', password: 'password123', name: 'B', emailVerified: true }).save();
    token = sign(user); otherToken = sign(other);
    video = await Content.create({ userId: user._id, title: 'Three money mistakes', type: 'video', status: 'completed' });
    otherVideo = await Content.create({ userId: other._id, title: 'Not yours', type: 'video', status: 'completed' });
  });

  it('rejects bad input with a clear 400', async () => {
    const base = { contentId: String(video._id), platform: 'tiktok', views: 100 };
    expect((await post(token, { ...base, platform: 'myspace' })).status).toBe(400);
    expect((await post(token, { ...base, views: undefined })).status).toBe(400);
    expect((await post(token, { ...base, views: -5 })).status).toBe(400);
    expect((await post(token, { ...base, likes: 'lots' })).status).toBe(400);
    expect((await post(token, { ...base, avgWatchPercent: 140 })).status).toBe(400);
    expect((await post(token, { ...base, postUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await post(token, { ...base, postedAt: new Date(Date.now() + 7 * 86400000).toISOString() })).status).toBe(400);
    expect(await ScheduledPost.countDocuments({ userId: String(user._id) })).toBe(0);
  });

  it("will not log results against someone else's video", async () => {
    const res = await post(token, { contentId: String(otherVideo._id), platform: 'tiktok', views: 100 });
    expect(res.status).toBe(403);
    expect(await ScheduledPost.countDocuments({ contentId: String(otherVideo._id) })).toBe(0);
  });

  it('stores the numbers where the analytics, posting-time and learning code read them', async () => {
    const res = await post(token, {
      contentId: String(video._id), platform: 'tiktok', views: 1200, likes: 90, comments: 6, shares: 4,
      avgWatchPercent: 62, postUrl: 'https://www.tiktok.com/@me/video/1',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.learning).toBe('queued');
    expect(res.body.data.comparison).toMatchObject({ medianViews: null, needMorePosts: 3 });

    const row = await ScheduledPost.findOne({ userId: String(user._id), contentId: String(video._id) }).lean();
    expect(row).toMatchObject({ status: 'posted', platform: 'tiktok', metadata: { source: 'manual-results', postUrl: 'https://www.tiktok.com/@me/video/1' } });
    expect(row.analytics).toMatchObject({
      views: 1200, likes: 90, comments: 6, shares: 4, reach: 1200, engagement: 100,
      engagementBreakdown: { views: 1200, likes: 90 }, watchTime: { averagePercentage: 62 },
    });
    expect(row.analytics.lastUpdated).toBeTruthy();
    expect(row.lastLearnedAt).toBeNull();
  });

  it('updates the same row; only a real change re-queues it for learning', async () => {
    const before = await ScheduledPost.findOne({ contentId: String(video._id) }).lean();
    const same = await post(token, { contentId: String(video._id), platform: 'tiktok', views: 1200 });
    expect(same.status).toBe(200);
    expect(same.body.data.learning).toBe('unchanged');
    const afterSame = await ScheduledPost.findOne({ contentId: String(video._id) }).lean();
    expect(afterSame.analytics.lastUpdated.getTime()).toBe(before.analytics.lastUpdated.getTime());
    // Fields left out keep their earlier values.
    expect(afterSame.analytics).toMatchObject({ likes: 90, watchTime: { averagePercentage: 62 } });

    const changed = await post(token, { contentId: String(video._id), platform: 'tiktok', views: 5000 });
    expect(changed.body.data.learning).toBe('queued');
    expect(await ScheduledPost.countDocuments({ contentId: String(video._id) })).toBe(1);
  });

  it('compares a result with the creator’s own typical views once there are 3 posts', async () => {
    for (const views of [1000, 2000, 3000]) {
      const c = await Content.create({ userId: user._id, title: `v${views}`, type: 'video', status: 'completed' });
      await post(token, { contentId: String(c._id), platform: 'youtube', views });
    }
    const c = await Content.create({ userId: user._id, title: 'big one', type: 'video', status: 'completed' });
    const res = await post(token, { contentId: String(c._id), platform: 'youtube', views: 8000 });
    expect(res.body.data.comparison).toMatchObject({ medianViews: 2000, ratio: 4, sampleSize: 3, needMorePosts: 0 });

    const list = await as(token)(request(app).get('/api/post-results'));
    expect(list.status).toBe(200);
    const big = list.body.data.results.find((r) => r.title === 'big one');
    expect(big).toMatchObject({ platform: 'youtube', views: 8000, source: 'manual' });
    expect(big.vsTypical).toBeGreaterThan(1);
    // Another creator sees none of it.
    const theirs = await as(otherToken)(request(app).get('/api/post-results'));
    expect(theirs.body.data.results).toEqual([]);
  });

  it('the learning pass learns from a logged result (views-only counts too)', async () => {
    const res = await runLearningTick();
    expect(res.processed).toBeGreaterThan(0);
    const learned = await ScheduledPost.find({ userId: String(user._id), lastLearnedAt: { $ne: null } }).lean();
    expect(learned.length).toBeGreaterThan(0);
    const profile = await UserStyleProfile.findOne({ userId: user._id }).lean();
    expect(profile).toBeTruthy();
    expect(profile.weightedPacing.length).toBeGreaterThan(0);
    // The 4x-typical YouTube video must have moved the profile up, not stayed at 0.
    expect(profile.weightedPacing.some((c) => c.performanceScore > 0)).toBe(true);
    // A second pass with nothing new learns nothing (single writer, no double count).
    expect((await runLearningTick()).processed).toBe(0);
  });

  it('deletes only results the creator typed in', async () => {
    const mine = await ScheduledPost.findOne({ userId: String(user._id), 'metadata.source': 'manual-results' });
    expect((await as(otherToken)(request(app).delete(`/api/post-results/${mine._id}`))).status).toBe(404);
    const published = await ScheduledPost.create({
      userId: String(user._id), platform: 'tiktok', status: 'posted', scheduledTime: new Date(), postedAt: new Date(),
    });
    expect((await as(token)(request(app).delete(`/api/post-results/${published._id}`))).status).toBe(404);
    expect((await as(token)(request(app).delete(`/api/post-results/${mine._id}`))).status).toBe(200);
    expect(await ScheduledPost.findById(mine._id)).toBeNull();
  });
});

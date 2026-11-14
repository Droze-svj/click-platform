// The learning signal and the platform-analytics save path.
//
// 1. computePerformanceDelta: views-only posts must teach the loop (reach vs the
//    creator's own typical views); missing data is "no signal", never a guess.
// 2. syncPostAnalytics used to throw on every save (spreading the hydrated
//    Mongoose nested `analytics` path fails validation) and the strict schema
//    dropped views/likes/watchTime — so no platform result was ever stored.

jest.mock('../../../server/services/tokenRefreshService', () => ({
  getValidAccessToken: jest.fn().mockResolvedValue('test-token'),
}));
const mockPost = jest.fn();
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, create: () => ({ post: (...a) => mockPost(...a), get: jest.fn() }) };
});

const ScheduledPost = require('../../../server/models/ScheduledPost');
const {
  computePerformanceDelta, computeReachDelta, computeRetentionDelta,
} = require('../../../server/services/creatorPerformanceService');
const { syncPostAnalytics } = require('../../../server/services/platformAnalyticsService');

describe('learning signal', () => {
  it('uses reach vs the creator’s own baseline when there is no retention', () => {
    expect(computePerformanceDelta({ views: 4000, baselineViews: 1000 })).toBeCloseTo(1);
    expect(computePerformanceDelta({ views: 2000, baselineViews: 1000 })).toBeCloseTo(0.5);
    expect(computePerformanceDelta({ views: 500, baselineViews: 1000 })).toBeCloseTo(-0.5);
  });

  it('averages retention and reach when both are measured', () => {
    const d = computePerformanceDelta({ views: 2000, baselineViews: 1000, watchTime: { averagePercentage: 75 } });
    expect(d).toBeCloseTo((0.2 + 0.5) / 2);
  });

  it('gives no signal (0) without data — no baseline, no retention', () => {
    expect(computePerformanceDelta({ views: 5000 })).toBe(0);
    expect(computePerformanceDelta({ views: 5000, baselineViews: null, watchTime: { averagePercentage: null } })).toBe(0);
    expect(computeReachDelta({ views: 0, baselineViews: 100 })).toBeNull();
  });

  it('keeps the old retention-only behaviour', () => {
    expect(computeRetentionDelta({ retentionRate: 0.65 })).toBeCloseTo(0.1);
    expect(computePerformanceDelta({ retentionRate: 0.65 })).toBeCloseTo(0.1);
  });
});

describe('platform analytics sync saves the numbers', () => {
  it('persists views/likes and stamps lastUpdated only when they move', async () => {
    const post = await ScheduledPost.create({
      userId: 'sync-user', platform: 'tiktok', status: 'posted', scheduledTime: new Date(),
      postedAt: new Date(), platformPostId: 'vid-1', contentId: 'c-sync',
    });
    mockPost.mockResolvedValue({ data: { data: { videos: [{ id: 'vid-1', view_count: 1500, like_count: 70, comment_count: 4, share_count: 2 }] } } });

    await syncPostAnalytics('sync-user', post._id);
    const first = await ScheduledPost.findById(post._id).lean();
    expect(first.analytics).toMatchObject({ views: 1500, likes: 70, comments: 4, shares: 2 });
    const stamped = first.analytics.lastUpdated.getTime();

    await syncPostAnalytics('sync-user', post._id);
    const same = await ScheduledPost.findById(post._id).lean();
    expect(same.analytics.lastUpdated.getTime()).toBe(stamped);

    mockPost.mockResolvedValue({ data: { data: { videos: [{ id: 'vid-1', view_count: 2600, like_count: 90, comment_count: 4, share_count: 2 }] } } });
    await new Promise((r) => setTimeout(r, 5));
    await syncPostAnalytics('sync-user', post._id);
    const moved = await ScheduledPost.findById(post._id).lean();
    expect(moved.analytics.views).toBe(2600);
    expect(moved.analytics.lastUpdated.getTime()).toBeGreaterThan(stamped);
  });
});

describe('UserStyleProfile.recordPerformance with the cron’s string userId', () => {
  it('writes to the profile readers find (ObjectId), not an orphan keyed by a string', async () => {
    const mongoose = require('mongoose');
    const UserStyleProfile = require('../../../server/models/UserStyleProfile');
    const oid = new mongoose.Types.ObjectId();
    await UserStyleProfile.recordPerformance(String(oid), 'weightedPacing', 'steady-breathing', 0.4);
    await UserStyleProfile.recordPerformance(oid, 'weightedPacing', 'steady-breathing', 0.4);
    const docs = await UserStyleProfile.collection.find({ $or: [{ userId: oid }, { userId: String(oid) }] }).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].userId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(docs[0].weightedPacing[0]).toMatchObject({ key: 'steady-breathing', sampleSize: 2 });
  });
});

const mongoose = require('mongoose');
const Content = require('../../../server/models/Content');
const VideoMetrics = require('../../../server/models/VideoMetrics');
const { getRetentionInsights } = require('../../../server/services/retentionAnalysisService');
const { getOutliers } = require('../../../server/services/velocityOutlierService');

const uidA = '6b1000000000000000000aaa';
const uidB = '6b1000000000000000000bbb';

async function makeContent(userId, createdAt) {
  return Content.create({ userId: String(userId), type: 'video', title: 'v', createdAt });
}
async function makeMetrics(contentId, { views = 100, curve = [] } = {}) {
  return VideoMetrics.create({
    contentId,
    postId: new mongoose.Types.ObjectId(),
    workspaceId: new mongoose.Types.ObjectId(),
    platform: 'youtube',
    video: { duration: 60, type: 'short_form' },
    views: { total: views },
    retention: { curve },
  });
}

afterEach(async () => {
  await Promise.all([Content.deleteMany({}), VideoMetrics.deleteMany({})]);
});

describe('getRetentionInsights (E2E, ownership-grounded)', () => {
  it('returns the analyzed real curve for the owner', async () => {
    const c = await makeContent(uidA);
    await makeMetrics(c._id, { curve: [{ second: 0, percentage: 100 }, { second: 3, percentage: 55 }, { second: 10, percentage: 50 }] });
    const r = await getRetentionInsights(c._id, uidA);
    expect(r.available).toBe(true);
    expect(r.hookScore).toBeLessThan(70); // big early drop
    expect(Array.isArray(r.dropOffs)).toBe(true);
  });

  it('does NOT leak another user\'s content (IDOR protection)', async () => {
    const c = await makeContent(uidA);
    await makeMetrics(c._id, { curve: [{ second: 0, percentage: 100 }, { second: 5, percentage: 80 }] });
    const r = await getRetentionInsights(c._id, uidB); // different user
    expect(r.available).toBe(false);
    expect(r.reason).toBe('not_found');
  });

  it('is honest when there is content but no metrics', async () => {
    const c = await makeContent(uidA);
    const r = await getRetentionInsights(c._id, uidA);
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_metrics');
  });
});

describe('getOutliers (E2E, scoped to the user)', () => {
  it('detects an overperformer among the user\'s own videos', async () => {
    const now = Date.now();
    const base = now - 30 * 86400000;
    for (const v of [100, 120, 110, 90]) {
      const c = await makeContent(uidA, new Date(base));
      await makeMetrics(c._id, { views: v });
    }
    const viral = await makeContent(uidA, new Date(base));
    await makeMetrics(viral._id, { views: 1000 });

    const r = await getOutliers(uidA, { nowMs: now, overMultiplier: 2 });
    expect(r.available).toBe(true);
    expect(r.outliers.length).toBeGreaterThanOrEqual(1);
    expect(r.outliers[0].views).toBe(1000);
    expect(r.outliers[0].vph).toBeGreaterThan(0);
  });

  it('excludes other users\' videos from the baseline', async () => {
    for (const v of [100, 100, 100]) {
      const c = await makeContent(uidA);
      await makeMetrics(c._id, { views: v });
    }
    // Another user's viral video must not appear.
    const other = await makeContent(uidB);
    await makeMetrics(other._id, { views: 99999 });

    const r = await getOutliers(uidA, { nowMs: Date.now() });
    const ids = r.outliers.concat(r.underperformers).map((o) => String(o.contentId));
    expect(ids).not.toContain(String(other._id));
    expect(r.count).toBe(3);
  });
});

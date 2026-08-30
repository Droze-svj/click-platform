// getTemplateTrends and getCreatorAnalytics used to throw a 501 that the route
// re-sent as a 500, so GET /api/templates/analytics and .../:id/trends were
// permanent server errors. They are now computed from the same join
// getTemplatePerformance uses: Content.metadata.templateId → AIConfidenceScore.

const mongoose = require('mongoose');
const AITemplate = require('../../../server/models/AITemplate');
const AIConfidenceScore = require('../../../server/models/AIConfidenceScore');
const Content = require('../../../server/models/Content');
const {
  getTemplateTrends,
  getCreatorAnalytics,
  getTemplatePerformance,
} = require('../../../server/services/templateAnalyticsService');

const ownerA = new mongoose.Types.ObjectId();
const ownerB = new mongoose.Types.ObjectId();
const workspace = new mongoose.Types.ObjectId();

/** AITemplate requires prompt + agencyWorkspaceId. */
const makeTemplate = (name, createdBy) =>
  AITemplate.create({ name, createdBy, agencyWorkspaceId: workspace, prompt: 'test prompt' });

/** Content created `daysAgo` days back, carrying a confidence score. */
async function seedUse(templateId, daysAgo, { confidence, editEffort, needsReview }) {
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);

  const content = await Content.create({
    userId: ownerA,
    type: 'video',
    title: `use-${templateId}-${daysAgo}`,
    status: 'completed',
    metadata: { templateId: String(templateId) },
    createdAt,
  });
  await AIConfidenceScore.create({
    contentId: content._id,
    overallConfidence: confidence,
    editEffort,
    needsHumanReview: needsReview,
  });
  return content;
}

describe('template analytics', () => {
  let templateA, templateB, templateOther;

  beforeAll(async () => {
    templateA = await makeTemplate('Template A', ownerA);
    templateB = await makeTemplate('Template B', ownerA);
    templateOther = await makeTemplate('Other Owner', ownerB);

    // Template A: 2 uses 3 days ago, 1 use 10 days ago.
    await seedUse(templateA._id, 3, { confidence: 90, editEffort: 10, needsReview: false });
    await seedUse(templateA._id, 3, { confidence: 70, editEffort: 30, needsReview: true });
    await seedUse(templateA._id, 10, { confidence: 80, editEffort: 20, needsReview: false });
    // Template B: never used. templateOther belongs to another creator.
    await seedUse(templateOther._id, 2, { confidence: 50, editEffort: 60, needsReview: true });
  });

  afterAll(async () => {
    const ids = [templateA._id, templateB._id, templateOther._id];
    const content = await Content.find({ 'metadata.templateId': { $in: ids.map(String) } }).select('_id').lean();
    await AIConfidenceScore.deleteMany({ contentId: { $in: content.map((c) => c._id) } });
    await Content.deleteMany({ _id: { $in: content.map((c) => c._id) } });
    await AITemplate.deleteMany({ _id: { $in: ids } });
  });

  describe('getTemplateTrends', () => {
    it('buckets real usage by day and emits a continuous series', async () => {
      const res = await getTemplateTrends(templateA._id, 30);

      expect(res.template.name).toBe('Template A');
      expect(res.periodDays).toBe(30);
      // Continuous: one entry per day, including days with no usage.
      expect(res.series).toHaveLength(30);
      expect(res.series.every((d) => typeof d.date === 'string' && typeof d.usage === 'number')).toBe(true);

      expect(res.totals.usage).toBe(3);
      // (90 + 70 + 80) / 3
      expect(res.totals.avgConfidence).toBe(80);
      // 1 of 3 flagged
      expect(res.totals.needsReviewRate).toBeCloseTo(33.33, 1);

      const busiest = res.series.find((d) => d.usage === 2);
      expect(busiest).toBeTruthy();
      expect(busiest.avgConfidence).toBe(80); // (90 + 70) / 2
      expect(busiest.needsReviewCount).toBe(1);
    });

    it('excludes usage older than the window', async () => {
      // 5-day window drops the 10-days-ago use.
      const res = await getTemplateTrends(templateA._id, 5);
      expect(res.totals.usage).toBe(2);
      expect(res.series).toHaveLength(5);
    });

    it('throws for an unknown template', async () => {
      await expect(getTemplateTrends(new mongoose.Types.ObjectId(), 30)).rejects.toThrow('Template not found');
    });
  });

  describe('getCreatorAnalytics', () => {
    it("aggregates only the caller's own templates", async () => {
      const res = await getCreatorAnalytics(ownerA, 30);

      expect(res.totals.templates).toBe(2); // A and B, not templateOther
      expect(res.totals.usage).toBe(3);
      expect(res.templates.map((t) => t.name).sort()).toEqual(['Template A', 'Template B']);
      // The other creator's template and its usage must not leak in.
      expect(res.templates.some((t) => t.name === 'Other Owner')).toBe(false);
      expect(res.totals.avgConfidence).toBe(80);
    });

    it('ranks by usage and reports never-used templates', async () => {
      const res = await getCreatorAnalytics(ownerA, 30);
      expect(res.mostUsed.name).toBe('Template A');
      expect(res.mostUsed.usage).toBe(3);
      expect(res.unused.map((t) => t.name)).toEqual(['Template B']);
    });

    it('returns honest zeros for a creator with no templates', async () => {
      const res = await getCreatorAnalytics(new mongoose.Types.ObjectId(), 30);
      expect(res.totals).toMatchObject({ templates: 0, usage: 0, avgConfidence: 0 });
      expect(res.templates).toEqual([]);
    });

    it('requires a userId rather than silently aggregating everyone', async () => {
      await expect(getCreatorAnalytics(null, 30)).rejects.toThrow('userId is required');
    });
  });

  describe('getTemplatePerformance', () => {
    it('counts usage when called with no period (regression: createdAt:{} matched nothing)', async () => {
      const res = await getTemplatePerformance(templateA._id);
      expect(res.metrics.totalUsage).toBe(3);
      expect(res.metrics.avgConfidence).toBe(80);
    });
  });
});

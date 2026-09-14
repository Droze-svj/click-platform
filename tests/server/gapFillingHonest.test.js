/**
 * gapFillingService — POST /api/clients/:id/gaps/fill and /api/agency/:id/gaps/bulk-fill.
 *
 * Before: every gap was saved as `new Content({ ...generateContent(...), type:
 * 'post' })` with no userId. Content requires userId and has no 'post' type, so
 * nothing was ever created while the route answered "Gaps filled"; and what it
 * tried to save was an unrelated content *idea* under a hardcoded title. Bulk fill
 * queried a Workspace field that does not exist, so it processed zero clients.
 *
 * Now platform gaps are filled by really adapting existing text, everything else
 * is skipped with a reason, and bulk fill finds the agency's actual clients.
 * Runs against the in-memory MongoDB from tests/setup.js.
 */

jest.mock('../../server/services/contentAdaptationService', () => ({
  adaptContentForPlatform: jest.fn(),
  adaptForPlatform: jest.fn(),
}));

const mongoose = require('mongoose');
const { adaptContentForPlatform } = require('../../server/services/contentAdaptationService');
const { fillContentGaps, bulkFillGaps } = require('../../server/services/gapFillingService');
const Content = require('../../server/models/Content');
const ScheduledPost = require('../../server/models/ScheduledPost');
const ContentHealth = require('../../server/models/ContentHealth');
const Workspace = require('../../server/models/Workspace');

const oid = () => new mongoose.Types.ObjectId();
const ADAPTED = { content: 'Adapted for tiktok', hashtags: ['#am'], optimized: true, score: null, suggestions: [] };
const DEGRADED = { content: 'Original post text', hashtags: [], optimized: false, degraded: true, score: null, suggestions: [] };
const platformGap = (platform = 'tiktok', priority = 8) =>
  ({ category: 'platform', description: `Not posting on ${platform}`, impact: 'medium', priority });

// Every test works in its own workspaces and removes what it made, so nothing
// leaks into other suites sharing the database.
const touched = new Set();
async function seedSource(workspaceId, userId, text = 'Original post text') {
  touched.add(String(workspaceId));
  return Content.create({ userId, workspaceId, type: 'article', status: 'completed', title: 'Source', content: { text } });
}

afterEach(async () => {
  const ids = [...touched].map((id) => new mongoose.Types.ObjectId(id));
  await Promise.all([
    Content.deleteMany({ workspaceId: { $in: ids } }),
    ScheduledPost.deleteMany({ workspaceId: { $in: ids } }),
    ContentHealth.deleteMany({ clientWorkspaceId: { $in: ids } }),
    Workspace.deleteMany({ _id: { $in: ids } }),
  ]);
  touched.clear();
  adaptContentForPlatform.mockReset();
});

describe('fillContentGaps', () => {
  it('fills a platform gap by saving a real adaptation owned by the user', async () => {
    const ws = oid(); const userId = oid();
    const source = await seedSource(ws, userId);
    adaptContentForPlatform.mockResolvedValue(ADAPTED);

    const out = await fillContentGaps(ws, { gaps: [platformGap()] }, { userId });

    expect(out.summary).toEqual({ total: 1, successful: 1, skipped: 0, failed: 0 });
    const saved = await Content.findOne({ workspaceId: ws, 'metadata.gapFilled': true }).lean();
    expect(saved).toMatchObject({
      type: 'article',
      platforms: ['tiktok'],
      content: { text: 'Adapted for tiktok', hashtags: ['#am'] },
      metadata: { gapType: 'platform', adaptedFor: 'tiktok' },
    });
    expect(String(saved.userId)).toBe(String(userId));
    expect(String(saved.metadata.sourceContentId)).toBe(String(source._id));
  });

  it('saves nothing when the model could not adapt the text, and says why', async () => {
    const ws = oid(); const userId = oid();
    await seedSource(ws, userId);
    adaptContentForPlatform.mockResolvedValue(DEGRADED);

    const out = await fillContentGaps(ws, { gaps: [platformGap()] }, { userId });

    expect(out.summary).toEqual({ total: 1, successful: 0, skipped: 1, failed: 0 });
    expect(out.skipped[0].reason).toMatch(/unavailable/);
    expect(await Content.countDocuments({ workspaceId: ws, 'metadata.gapFilled': true })).toBe(0);
  });

  it('skips format and timing gaps without calling the model or saving anything', async () => {
    const ws = oid(); const userId = oid();
    await seedSource(ws, userId);
    const gaps = [
      { category: 'format', description: 'Missing video content', impact: 'high', priority: 9 },
      { category: 'timing', description: 'Inconsistent posting on tiktok', impact: 'medium', priority: 8 },
    ];

    const out = await fillContentGaps(ws, { gaps }, { userId });

    expect(out.summary).toEqual({ total: 2, successful: 0, skipped: 2, failed: 0 });
    expect(out.skipped.map((s) => s.reason)).toEqual([
      expect.stringMatching(/media/), expect.stringMatching(/schedule/),
    ]);
    expect(adaptContentForPlatform).not.toHaveBeenCalled();
    expect(await Content.countDocuments({ workspaceId: ws, 'metadata.gapFilled': true })).toBe(0);
  });

  it('fails a gap cleanly when no user is given, rather than saving an ownerless item', async () => {
    const ws = oid();
    touched.add(String(ws));
    const out = await fillContentGaps(ws, { gaps: [platformGap()] }, {});
    expect(out.summary).toEqual({ total: 1, successful: 0, skipped: 0, failed: 1 });
    expect(adaptContentForPlatform).not.toHaveBeenCalled();
  });

  it('skips when the workspace has no text content to adapt', async () => {
    const ws = oid(); const userId = oid();
    touched.add(String(ws));
    const out = await fillContentGaps(ws, { gaps: [platformGap()] }, { userId });
    expect(out.skipped[0].reason).toMatch(/no text content/);
    expect(adaptContentForPlatform).not.toHaveBeenCalled();
  });

  it('auto-schedules only the adapted post, with its owner', async () => {
    const ws = oid(); const userId = oid();
    await seedSource(ws, userId);
    adaptContentForPlatform.mockResolvedValue(ADAPTED);

    const out = await fillContentGaps(ws, { gaps: [platformGap()] }, { userId, autoSchedule: true });

    expect(out.summary.successful).toBe(1);
    const post = await ScheduledPost.findOne({ workspaceId: ws }).lean();
    expect(post).toMatchObject({ platform: 'tiktok', status: 'pending', content: { text: 'Adapted for tiktok' } });
    expect(String(post.userId)).toBe(String(userId));
  });

  it('still applies the priority filter', async () => {
    const ws = oid(); const userId = oid();
    touched.add(String(ws));
    const out = await fillContentGaps(ws, { gaps: [platformGap('tiktok', 6)] }, { userId });
    expect(out.summary.total).toBe(0);
  });
});

describe('bulkFillGaps', () => {
  it("fills the agency's real clients — linked by metadata or by owner — and nobody else's", async () => {
    const agencyOwner = oid(); const otherOwner = oid(); const strangerOwner = oid();
    const actingUser = oid();

    const agency = await Workspace.create({ name: 'Agency', type: 'agency', ownerId: agencyOwner, userId: agencyOwner });
    const linkedByMetadata = await Workspace.create({
      name: 'Client A', type: 'client', ownerId: otherOwner, userId: otherOwner,
      metadata: { agencyWorkspaceId: agency._id },
    });
    const linkedByOwner = await Workspace.create({ name: 'Client B', type: 'client', ownerId: agencyOwner, userId: agencyOwner });
    const foreign = await Workspace.create({ name: 'Not ours', type: 'client', ownerId: strangerOwner, userId: strangerOwner });
    for (const w of [agency, linkedByMetadata, linkedByOwner, foreign]) touched.add(String(w._id));

    for (const client of [linkedByMetadata, linkedByOwner, foreign]) {
      await seedSource(client._id, client.ownerId);
      await ContentHealth.create({
        clientWorkspaceId: client._id, agencyWorkspaceId: agency._id, overallScore: 50,
        analysisDate: new Date(), gaps: [platformGap()],
      });
    }
    adaptContentForPlatform.mockResolvedValue(ADAPTED);

    const out = await bulkFillGaps(String(agency._id), {
      userId: actingUser,
      // The foreign id is supplied on purpose: it must not be filled.
      clientWorkspaceIds: [String(linkedByMetadata._id), String(linkedByOwner._id), String(foreign._id)],
    });

    expect(out).toMatchObject({ total: 2, successful: 2, failed: 0, totalGenerated: 2 });
    const filled = await Content.find({ 'metadata.gapFilled': true, workspaceId: { $in: [linkedByMetadata._id, linkedByOwner._id, foreign._id] } }).lean();
    expect(filled.map((c) => String(c.workspaceId)).sort()).toEqual([String(linkedByMetadata._id), String(linkedByOwner._id)].sort());
    for (const c of filled) expect(String(c.userId)).toBe(String(actingUser));
  });
});

/**
 * POST /api/agency/:agencyWorkspaceId/bulk/customize-and-schedule
 *
 * Posts with no explicit date used to fall straight through to `new Date()`
 * (publish immediately). The route imported `getOptimalPostingTimes` from
 * smartScheduleOptimizationService — a name that service never exported — and
 * never called it, so the intended smart-timing behaviour was never wired.
 *
 * It is now opt-in via `scheduleOptions.optimizeTiming`, so existing callers
 * keep the old "schedule for now" default, and the prediction is cached per
 * (workspace owner, platform) because predictOptimalTime derives its answer
 * from those alone.
 */

// `mock`-prefixed so jest's hoisted factory is allowed to close over it.
const mockPredictOptimalTime = jest.fn();
jest.mock('../../../server/services/smartScheduleOptimizationService', () => ({
  predictOptimalTime: (...args) => mockPredictOptimalTime(...args),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Workspace = require('../../../server/models/Workspace');
const Content = require('../../../server/models/Content');
const ScheduledPost = require('../../../server/models/ScheduledPost');

describe('agency bulk customize-and-schedule: optimal timing', () => {
  let owner, agency, clientA, clientB, source, token;

  beforeAll(async () => {
    owner = await new User({
      email: 'agency-timing@example.com', password: 'password123',
      name: 'Agency Owner', emailVerified: true,
    }).save();

    token = jwt.sign({ userId: owner._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

    agency = await new Workspace({
      name: 'Agency', type: 'agency', ownerId: owner._id, userId: owner._id,
    }).save();
    // Owned by the agency owner, which is how verifyClientWorkspaceAccess links them.
    clientA = await new Workspace({
      name: 'Client A', type: 'client', ownerId: owner._id, userId: owner._id,
    }).save();
    clientB = await new Workspace({
      name: 'Client B', type: 'client', ownerId: owner._id, userId: owner._id,
    }).save();

    source = await new Content({
      userId: owner._id, agencyWorkspaceId: agency._id, type: 'video',
      title: 'Source', status: 'completed', platforms: ['tiktok'],
      content: { text: 'hello' },
    }).save();
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteOne({ _id: owner._id }),
      Workspace.deleteMany({ _id: { $in: [agency._id, clientA._id, clientB._id] } }),
      Content.deleteMany({ agencyWorkspaceId: agency._id }),
      ScheduledPost.deleteMany({ agencyWorkspaceId: agency._id }),
    ]);
  });

  beforeEach(async () => {
    mockPredictOptimalTime.mockReset();
    await ScheduledPost.deleteMany({ agencyWorkspaceId: agency._id });
  });

  const post = (scheduleOptions) => request(app)
    .post(`/api/agency/${agency._id}/bulk/customize-and-schedule`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      contentId: String(source._id),
      clientWorkspaceIds: [String(clientA._id), String(clientB._id)],
      scheduleOptions,
    });

  it('does NOT predict by default — unchanged "schedule now" behaviour', async () => {
    const res = await post({ enabled: true });

    expect(res.status).toBe(200);
    expect(mockPredictOptimalTime).not.toHaveBeenCalled();
    const posts = await ScheduledPost.find({ agencyWorkspaceId: agency._id });
    expect(posts).toHaveLength(2);
    for (const p of posts) expect(p.scheduledTime.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('schedules at the predicted time when optimizeTiming is set', async () => {
    const best = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    mockPredictOptimalTime.mockResolvedValue({ bestTime: { scheduledTime: best }, predictions: [] });

    const res = await post({ enabled: true, optimizeTiming: true });

    expect(res.status).toBe(200);
    const posts = await ScheduledPost.find({ agencyWorkspaceId: agency._id });
    expect(posts).toHaveLength(2);
    for (const p of posts) expect(p.scheduledTime.getTime()).toBe(best.getTime());
  });

  it('predicts once per (owner, platform), not once per client', async () => {
    mockPredictOptimalTime.mockResolvedValue({
      bestTime: { scheduledTime: new Date(Date.now() + 3600 * 1000) }, predictions: [],
    });

    await post({ enabled: true, optimizeTiming: true });

    // Two client workspaces, one shared owner, one platform => a single call.
    expect(mockPredictOptimalTime).toHaveBeenCalledTimes(1);
    const [userId, , platform] = mockPredictOptimalTime.mock.calls[0];
    expect(String(userId)).toBe(String(owner._id));
    expect(platform).toBe('tiktok');
  });

  it('falls back to immediate scheduling when prediction fails', async () => {
    mockPredictOptimalTime.mockRejectedValue(new Error('audience service down'));

    const res = await post({ enabled: true, optimizeTiming: true });

    expect(res.status).toBe(200);
    const posts = await ScheduledPost.find({ agencyWorkspaceId: agency._id });
    expect(posts).toHaveLength(2);
    for (const p of posts) expect(p.scheduledTime.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

/**
 * The compliance endpoints ComplianceDashboard has always called.
 *
 * The page is mounted at /dashboard/compliance and issued six requests, none of
 * which had a route. Every call sat behind `if (res.ok)` / `catch { silent }`,
 * so it rendered an empty rule list with no error — a compliance surface
 * silently reporting nothing. The ComplianceRule model was fully built and
 * referenced by no code at all.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Workspace = require('../../../server/models/Workspace');
const ComplianceRule = require('../../../server/models/ComplianceRule');

describe('moderation compliance endpoints', () => {
  let owner, other, ws, token, otherToken;

  beforeAll(async () => {
    owner = await new User({ email: 'compliance-owner@example.com', password: 'password123', name: 'Owner', emailVerified: true }).save();
    other = await new User({ email: 'compliance-other@example.com', password: 'password123', name: 'Other', emailVerified: true }).save();
    token = jwt.sign({ userId: owner._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    otherToken = jwt.sign({ userId: other._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    ws = await new Workspace({ name: 'WS', type: 'brand', ownerId: String(owner._id), userId: String(owner._id) }).save();
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ _id: { $in: [owner._id, other._id] } }),
      Workspace.deleteOne({ _id: ws._id }),
      ComplianceRule.deleteMany({ workspaceId: ws._id }),
    ]);
  });

  beforeEach(async () => { await ComplianceRule.deleteMany({ workspaceId: ws._id }); });

  const as = (tok, r) => r.set('Authorization', `Bearer ${tok}`);

  it('serves published platform policies', async () => {
    const res = await as(token, request(app).get('/api/moderation/platform-policies'));
    expect(res.status).toBe(200);
    const data = res.body.data ?? res.body;
    expect(data.twitter.maxCharacters).toBe(280);
    expect(data.tiktok.noExternalLinks).toBe(true);
  });

  it('creates, lists and deletes a rule', async () => {
    const created = await as(token, request(app).post('/api/moderation/rules')).send({
      name: 'No competitors', category: 'brand_safety', ruleType: 'keyword_block',
      keywords: ['acme'], severity: 'error', action: 'block',
    });
    expect(created.status).toBe(201);
    const rule = created.body.data ?? created.body;
    expect(rule.name).toBe('No competitors');

    const list = await as(token, request(app).get('/api/moderation/rules'));
    expect((list.body.data ?? list.body)).toHaveLength(1);

    const del = await as(token, request(app).delete(`/api/moderation/rules/${rule._id}`));
    expect(del.status).toBe(200);
    expect(await ComplianceRule.countDocuments({ workspaceId: ws._id })).toBe(0);
  });

  it('rejects an incomplete rule and an uncompilable regex', async () => {
    const missing = await as(token, request(app).post('/api/moderation/rules')).send({ name: 'x' });
    expect(missing.status).toBe(400);

    const badRe = await as(token, request(app).post('/api/moderation/rules')).send({
      name: 'bad', category: 'custom', ruleType: 'regex', pattern: '([unclosed',
    });
    expect(badRe.status).toBe(400);
  });

  it("will not delete another workspace's rule", async () => {
    const rule = await new ComplianceRule({
      workspaceId: ws._id, createdBy: String(owner._id),
      name: 'Mine', category: 'custom', ruleType: 'keyword_block', keywords: ['x'],
    }).save();

    const res = await as(otherToken, request(app).delete(`/api/moderation/rules/${rule._id}`));
    expect(res.status).toBe(404);
    expect(await ComplianceRule.countDocuments({ _id: rule._id })).toBe(1);
  });

  it('checks text against stored rules and platform limits', async () => {
    await new ComplianceRule({
      workspaceId: ws._id, createdBy: String(owner._id), name: 'No competitors',
      category: 'brand_safety', ruleType: 'keyword_block', keywords: ['acme'], severity: 'error',
    }).save();

    const res = await as(token, request(app).post('/api/moderation/compliance-check')).send({
      text: 'Check out ACME today! ' + 'x'.repeat(300),
      platforms: ['twitter'],
    });

    expect(res.status).toBe(200);
    const r = res.body.data ?? res.body;
    expect(r.status).toBe('failed');           // blocked keyword + over 280 chars
    expect(r.score).toBeLessThan(100);
    expect(r.breakdown.brandSafety.passed).toBe(false);
    expect(r.breakdown.platformPolicy.twitter.passed).toBe(false);
    expect(r.breakdown.ai).toBeNull();          // honest: no AI pass ran
    expect(r.issues.some((i) => /acme/i.test(i.message))).toBe(true);
  });

  it('passes clean text and requires a body', async () => {
    const ok = await as(token, request(app).post('/api/moderation/compliance-check'))
      .send({ text: 'A perfectly ordinary caption.', platforms: ['twitter'] });
    expect(ok.status).toBe(200);
    expect((ok.body.data ?? ok.body).status).toBe('passed');

    const bad = await as(token, request(app).post('/api/moderation/compliance-check')).send({});
    expect(bad.status).toBe(400);
  });

  it('reports the workspace rule inventory', async () => {
    await new ComplianceRule({
      workspaceId: ws._id, createdBy: String(owner._id), name: 'R',
      category: 'profanity', ruleType: 'keyword_block', keywords: ['x'], triggerCount: 3,
    }).save();

    const res = await as(token, request(app).get('/api/moderation/report/workspace'));
    expect(res.status).toBe(200);
    const r = res.body.data ?? res.body;
    expect(r.totalRules).toBe(1);
    expect(r.activeRules).toBe(1);
    expect(r.totalTriggers).toBe(3);
    expect(r.byCategory.profanity.rules).toBe(1);
  });
});

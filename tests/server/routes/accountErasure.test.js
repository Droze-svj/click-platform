// "Delete my account" used to remove five collections and leave the rest:
// connected social-account tokens, uploaded/rendered media files, captions,
// notifications, style profile and ~130 other collections keyed by the user.
// Erasure now covers every owner-keyed collection plus the files, keeps
// payment records, needs the password, and ends the session.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const Notification = require('../../../server/models/Notification');
const SocialConnection = require('../../../server/models/SocialConnection');
const BillingHistory = require('../../../server/models/BillingHistory');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

const UPLOADS_ROOT = path.join(__dirname, '../../../uploads');

describe('account erasure and export', () => {
  let user; let other; let token; let otherToken;
  const rel = `videos/erasure-test-${Date.now()}.mp4`;
  const otherRel = `videos/erasure-keep-${Date.now()}.mp4`;

  beforeEach(async () => {
    await User.deleteMany({ email: { $in: ['erase-me@example.com', 'keep-me@example.com'] } });
    user = await new User({ email: 'erase-me@example.com', password: 'password123', name: 'Erase Me', emailVerified: true }).save();
    other = await new User({ email: 'keep-me@example.com', password: 'password123', name: 'Keep Me', emailVerified: true }).save();
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
    otherToken = jwt.sign({ userId: String(other._id) }, getJwtSecret(), { expiresIn: '1h' });
    fs.mkdirSync(path.join(UPLOADS_ROOT, 'videos'), { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_ROOT, rel), 'x');
    fs.writeFileSync(path.join(UPLOADS_ROOT, otherRel), 'x');
    await Content.create({ userId: user._id, title: 'Mine', type: 'video', originalFile: { url: `/uploads/${rel}` } });
    await Content.create({ userId: other._id, title: 'Theirs', type: 'video', originalFile: { url: `/uploads/${otherRel}` } });
    await Notification.create({ userId: String(user._id), type: 'info', title: 'Hi', message: 'Hello' });
    await SocialConnection.create({ userId: user._id, platform: 'tiktok', accessToken: 'secret-token', platformUserId: 'tt1' });
    await BillingHistory.create({ userId: user._id, invoiceNumber: `INV-${Date.now()}`, invoice: { date: new Date() }, status: 'paid' });
  });

  afterAll(() => {
    for (const r of [rel, otherRel]) fs.rmSync(path.join(UPLOADS_ROOT, r), { force: true });
  });

  const as = (t, r) => r.set('Authorization', `Bearer ${t}`);

  it('refuses without the password', async () => {
    const res = await as(token, request(app).delete('/api/privacy/delete')).send({ confirm: 'DELETE', password: 'wrong' });
    expect(res.status).toBe(403);
    expect(await User.findById(user._id)).not.toBeNull();
  });

  it('erases every owned collection and file, keeps payment records, and ends the session', async () => {
    expect(await SocialConnection.countDocuments({ userId: user._id })).toBe(1);
    expect(await BillingHistory.countDocuments({ userId: user._id })).toBe(1);

    const res = await as(token, request(app).delete('/api/privacy/delete')).send({ confirm: 'DELETE', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.erased).toBe(true);

    expect(await User.findById(user._id)).toBeNull();
    expect(await Content.countDocuments({ userId: user._id })).toBe(0);
    expect(await Notification.countDocuments({ userId: user._id })).toBe(0);
    expect(await SocialConnection.countDocuments({ userId: user._id })).toBe(0);
    expect(await BillingHistory.countDocuments({ userId: user._id })).toBe(1); // kept: payment records
    expect(fs.existsSync(path.join(UPLOADS_ROOT, rel))).toBe(false);

    // Another user's data and files are untouched.
    expect(await Content.countDocuments({ userId: other._id })).toBe(1);
    expect(fs.existsSync(path.join(UPLOADS_ROOT, otherRel))).toBe(true);

    // The old session no longer works.
    const after = await as(token, request(app).get('/api/auth/me'));
    expect(after.status).toBe(401);
    // …and the other user's still does.
    expect((await as(otherToken, request(app).get('/api/auth/me'))).status).toBe(200);
  });

  it('does not erase a paying account whose subscription could not be cancelled', async () => {
    const saved = process.env.WHOP_API_KEY;
    process.env.WHOP_API_KEY = '';
    try {
      await User.updateOne({ _id: user._id }, { $set: { subscription: { plan: 'pro', status: 'active', whopSubscriptionId: 'mem_still_billing' } } });
      const res = await as(token, request(app).delete('/api/privacy/delete')).send({ confirm: 'DELETE', password: 'password123' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SUBSCRIPTION_ACTIVE');
      expect(await User.findById(user._id)).not.toBeNull();
      expect(await Content.countDocuments({ userId: user._id })).toBe(1);
    } finally {
      if (saved === undefined) delete process.env.WHOP_API_KEY; else process.env.WHOP_API_KEY = saved;
    }
  });

  it('exports every collection without secrets', async () => {
    const res = await as(token, request(app).get('/api/privacy/export'));
    expect(res.status).toBe(200);
    expect(res.body.account.email).toBe('erase-me@example.com');
    expect(res.body.account.password).toBeUndefined();
    expect(res.body.data.Content).toHaveLength(1);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('Theirs');
  });
});

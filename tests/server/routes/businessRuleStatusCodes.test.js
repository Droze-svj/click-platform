/**
 * Handlers that turned an unmet precondition into a 500.
 *
 * All three were invisible to the write sweep because their families were in
 * SKIP_PREFIXES / SKIP_SUFFIX. Sweeping those (see tests/smoke/writeSweep.js)
 * is what surfaced them:
 *
 *   DELETE /api/backup/:filename   deleteBackup throws 'Invalid backup file'
 *                                  for a name that escapes the backup dir or
 *                                  belongs to another user, and 'Backup file
 *                                  not found' for a missing one. The route
 *                                  mapped EVERY error to 500 — while the
 *                                  sibling POST /verify/:filename returns 400
 *                                  for the identical ownership check.
 *   POST   /api/push/test          throws when the caller has no registered
 *                                  push subscription. That is the caller's
 *                                  state, not a server fault, and the handler
 *                                  also discarded the reason.
 *   POST   /api/posts/:id/publish  the one handler in posts.js missing the
 *                                  store-not-configured guard its siblings all
 *                                  have, so with Supabase off
 *                                  createSupabaseClient() returned null and
 *                                  `.from()` threw. /:id/schedule had the same
 *                                  hole, reachable only with a valid future
 *                                  date (an empty body 400s first), so the
 *                                  sweep could not see it.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');

describe('unmet preconditions are 4xx, not 500', () => {
  let user, token;

  beforeAll(async () => {
    user = await new User({
      email: 'business-rule-status@example.com', password: 'password123',
      name: 'Status Test', emailVerified: true,
    }).save();
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  });

  afterAll(async () => { await User.deleteOne({ _id: user._id }); });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  it('DELETE /api/backup/:filename — a file owned by someone else is 400, not 500', async () => {
    const res = await auth(request(app).delete('/api/backup/backup-someoneelse-123.json'));
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('DELETE /api/backup/:filename — a correctly-named but missing file is 404, not 500', async () => {
    const res = await auth(request(app).delete(`/api/backup/backup-${user._id}-doesnotexist.json`));
    expect(res.status).toBe(404);
  });

  it('POST /api/push/test — no registered subscription is 409, not 500', async () => {
    const res = await auth(request(app).post('/api/push/test'));
    expect(res.status).not.toBe(500);
    // 409 when push is configured, 503 when the server has no VAPID keypair.
    expect([409, 503]).toContain(res.status);
    expect(res.body.error).toBeTruthy();
    expect(res.body.error).not.toBe('Failed to send test notification');
  });

  it('POST /api/posts/:id/publish — Supabase off is 404, not 500', async () => {
    const res = await auth(request(app).post('/api/posts/507f1f77bcf86cd799439011/publish'));
    expect(res.status).not.toBe(500);
    expect([404, 503]).toContain(res.status);
  });

  it('POST /api/posts/:id/schedule — Supabase off is 404 even with a valid date', async () => {
    // A future date gets past the two validation guards and reaches the store,
    // which is the path the sweep's empty body never exercised.
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const res = await auth(
      request(app).post('/api/posts/507f1f77bcf86cd799439011/schedule').send({ scheduled_at: future })
    );
    expect(res.status).not.toBe(500);
    expect([404, 503]).toContain(res.status);
  });
});

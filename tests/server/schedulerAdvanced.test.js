// The three endpoints AdvancedSchedulingHub needs. None existed: the component
// was unreachable, so its 404s never surfaced anywhere.
//
// They are asserted against real rows rather than mocked, because the whole
// point of the analytics numbers is that they are derived, not estimated.

const request = require('supertest');
const app = require('../../server/index');
const User = require('../../server/models/User');
const ScheduledPost = require('../../server/models/ScheduledPost');
const jwt = require('jsonwebtoken');

describe('advanced scheduling endpoints', () => {
  let user; let token;

  const makePost = (over = {}) => ScheduledPost.create({
    userId: user._id,
    platform: 'tiktok',
    content: { text: 'hello' },
    scheduledTime: new Date(Date.now() + 3600_000),
    status: 'scheduled',
    ...over,
  });

  beforeEach(async () => {
    user = await User.findOneAndUpdate(
      { email: 'sched-adv@example.com' },
      { $setOnInsert: { password: 'password123', name: 'Sched', emailVerified: true } },
      { new: true, upsert: true }
    );
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  });

  afterEach(async () => {
    await ScheduledPost.deleteMany({ userId: user._id });
    await User.deleteMany({ email: 'sched-adv@example.com' });
  });

  it('GET /analytics derives its numbers from real rows', async () => {
    // Distinct minutes for the non-colliding rows — the default scheduledTime
    // would otherwise put all four in the same slot and make everything a
    // conflict (which is what a first draft of this test actually measured).
    const at = new Date(Date.now() + 7200_000);
    await makePost({ scheduledTime: at });               // collides with the next
    await makePost({ scheduledTime: at });               // same platform + minute
    await makePost({ scheduledTime: new Date(Date.now() + 10_800_000), metadata: { optimalTime: true } });
    await makePost({ scheduledTime: new Date(Date.now() + 14_400_000), status: 'posted' });

    const res = await request(app).get('/api/scheduler/analytics').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    // 3 scheduled + 1 posted; "active" counts only what is still ahead of publish.
    expect(res.body.byStatus.active).toBe(3);
    expect(res.body.byStatus.posted).toBe(1);
    expect(Math.round(res.body.optimalTimeUsage)).toBe(25);   // 1 of 4
    expect(Math.round(res.body.conflictRate)).toBe(50);       // 2 of 4 share a slot
  });

  it('GET /templates answers in the shape the hub renders', async () => {
    const res = await request(app).get('/api/scheduler/templates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const row of res.body) {
      expect(row).toHaveProperty('_id');
      expect(row).toHaveProperty('name');
      expect(Array.isArray(row.platforms)).toBe(true);
      expect(typeof row.usageCount).toBe('number');
    }
  });

  it('POST /bulk-reschedule shifts only the caller\'s movable posts', async () => {
    const mine = await makePost();
    const posted = await makePost({ status: 'posted' });
    const before = new Date(mine.scheduledTime).getTime();

    const res = await request(app)
      .post('/api/scheduler/bulk-reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ postIds: [String(mine._id), String(posted._id)], timeShiftMs: 3600_000 });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);   // the published one is not movable
    expect(res.body.skipped).toBe(1);

    const after = await ScheduledPost.findById(mine._id).lean();
    expect(new Date(after.scheduledTime).getTime()).toBe(before + 3600_000);

    const untouched = await ScheduledPost.findById(posted._id).lean();
    expect(new Date(untouched.scheduledTime).getTime()).toBe(new Date(posted.scheduledTime).getTime());
  });

  it('rejects a malformed bulk request rather than moving nothing quietly', async () => {
    await request(app).post('/api/scheduler/bulk-reschedule')
      .set('Authorization', `Bearer ${token}`).send({ postIds: [], timeShiftMs: 1 }).expect(400);
    await request(app).post('/api/scheduler/bulk-reschedule')
      .set('Authorization', `Bearer ${token}`).send({ postIds: ['x'], timeShiftMs: 'soon' }).expect(400);
  });
});

// Brand profile ownership guard.
//
// /api/brand was unmountable because brandService kept every saved profile in a
// single process-memory array: getProfiles(userId) ignored its userId argument
// and returned that shared array, so user A's saved Style DNA showed up in user
// B's list, and a restart erased everything. The route also had no auth at all
// and fell back to a literal 'mock-user-123'.
//
// These are behavioral tests (not source-text greps) because the invariant that
// matters is "B never sees A's profile", not the shape of the query.

const request = require('supertest');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const BrandProfile = require('../../../server/models/BrandProfile');
const jwt = require('jsonwebtoken');

const tokenFor = (user) =>
  jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

describe('brand profiles are per-user', () => {
  let userA, userB, tokenA, tokenB;

  beforeAll(async () => {
    userA = await User.create({
      email: 'brand-a@example.com', password: 'password123', name: 'Brand A', emailVerified: true,
    });
    userB = await User.create({
      email: 'brand-b@example.com', password: 'password123', name: 'Brand B', emailVerified: true,
    });
    tokenA = tokenFor(userA);
    tokenB = tokenFor(userB);
  });

  afterAll(async () => {
    await BrandProfile.deleteMany({ userId: { $in: [userA._id, userB._id] } });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  });

  it('requires authentication', async () => {
    await request(app).get('/api/brand/profiles').expect(401);
  });

  it("a saved profile is visible to its owner but NOT to another user", async () => {
    const created = await request(app)
      .post('/api/brand/profiles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A-only Profile', dna: { cpm: 9.5 } })
      .expect(201);

    const newId = created.body.data.id;
    expect(newId).toBeTruthy();

    const listA = await request(app)
      .get('/api/brand/profiles')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(listA.body.data.map((p) => p.id)).toContain(newId);

    const listB = await request(app)
      .get('/api/brand/profiles')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    // The regression this file exists for.
    expect(listB.body.data.map((p) => p.id)).not.toContain(newId);
    expect(listB.body.data.some((p) => p.name === 'A-only Profile')).toBe(false);
  });

  it('everyone still sees the read-only elite presets', async () => {
    const res = await request(app)
      .get('/api/brand/profiles')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const elite = res.body.data.filter((p) => p.isElite);
    expect(elite.length).toBeGreaterThanOrEqual(2);
    // Presets are built-ins, not documents — they must never carry an owner.
    for (const p of elite) expect(p.userId).toBeUndefined();
  });

  it("user B cannot delete user A's profile", async () => {
    const created = await request(app)
      .post('/api/brand/profiles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Not Yours', dna: { cpm: 3 } })
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .delete(`/api/brand/profiles/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    // Still there for its owner.
    expect(await BrandProfile.countDocuments({ _id: id, userId: userA._id })).toBe(1);

    await request(app)
      .delete(`/api/brand/profiles/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(await BrandProfile.countDocuments({ _id: id })).toBe(0);
  });

  it('a malformed profile id is a 404, not a 500', async () => {
    await request(app)
      .delete('/api/brand/profiles/not-an-objectid')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('client-supplied userId / isElite are ignored (no privilege via mass-assignment)', async () => {
    const res = await request(app)
      .post('/api/brand/profiles')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Sneaky', isElite: true, userId: String(userA._id), dna: { cpm: 1 } })
      .expect(201);

    expect(res.body.data.isElite).toBe(false);
    const doc = await BrandProfile.findById(res.body.data.id).lean();
    expect(String(doc.userId)).toBe(String(userB._id));
  });
});

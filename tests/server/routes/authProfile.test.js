// Profile edits must persist for MongoDB accounts (production has no
// Supabase). PUT /auth/profile and POST /auth/avatar used to treat every
// non-UUID id — i.e. every Mongo user — as a dev session: 200 "updated",
// nothing written, edits gone on reload.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('profile persistence (MongoDB accounts)', () => {
  let user;
  let token;

  beforeEach(async () => {
    await User.deleteMany({ email: 'profile-test@example.com' });
    user = await new User({ email: 'profile-test@example.com', password: 'password123', name: 'Old Name', emailVerified: true }).save();
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  it('saves profile fields and returns them on the next read', async () => {
    const res = await auth(request(app).put('/api/auth/profile')).send({
      name: 'Sam Rivera', username: 'sam', bio: 'I make videos', website: 'https://sam.example',
      location: 'Lisbon', niche: 'Finance', social_links: { twitter: 'https://x.com/sam', niche: 'ignored' },
    });
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
    expect(res.body.message).not.toMatch(/dev session/i);

    const saved = await User.findById(user._id).lean();
    expect(saved).toMatchObject({ name: 'Sam Rivera', username: 'sam', bio: 'I make videos', website: 'https://sam.example', location: 'Lisbon', niche: 'finance' });
    expect(saved.socialLinks).toEqual({ twitter: 'https://x.com/sam' });

    for (const path of ['/api/auth/me', '/api/auth/profile']) {
      const got = await auth(request(app).get(path));
      const p = got.body.user || got.body.profile;
      expect(p).toMatchObject({ name: 'Sam Rivera', username: 'sam', bio: 'I make videos', niche: 'finance', email_verified: true });
      expect(p.social_links).toEqual({ twitter: 'https://x.com/sam' });
    }
  });

  it('clears a field sent empty and rejects an unknown niche', async () => {
    await auth(request(app).put('/api/auth/profile')).send({ bio: 'temp' });
    await auth(request(app).put('/api/auth/profile')).send({ bio: '' });
    expect((await User.findById(user._id).lean()).bio).toBeUndefined();

    const bad = await auth(request(app).put('/api/auth/profile')).send({ niche: 'underwater basket weaving' });
    expect(bad.status).toBe(400);
  });

  it('saves an uploaded avatar', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const res = await auth(request(app).post('/api/auth/avatar')).attach('avatar', png, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    const saved = await User.findById(user._id).lean();
    expect(saved.avatar).toBe(res.body.avatar);
    expect((await auth(request(app).get('/api/auth/me'))).body.user.avatar).toBe(res.body.avatar);
  });
});

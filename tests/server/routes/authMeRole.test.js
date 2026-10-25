// The admin-only pages (Infrastructure) decide access from /auth/me's
// `role`. publicProfile used to leave it out, so every admin saw
// "Access denied". The connection + in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('/auth/me role', () => {
  const sign = (u) => jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });

  it('reports admin for an admin and user for everyone else, nothing sensitive', async () => {
    await User.deleteMany({ email: { $in: ['role-admin@example.com', 'role-user@example.com'] } });
    const admin = await new User({ email: 'role-admin@example.com', password: 'password123', name: 'A', role: 'admin', emailVerified: true }).save();
    const plain = await new User({ email: 'role-user@example.com', password: 'password123', name: 'U', emailVerified: true }).save();

    const a = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${sign(admin)}`);
    expect(a.status).toBe(200);
    expect(a.body.user.role).toBe('admin');
    expect(a.body.user.password).toBeUndefined();

    const u = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${sign(plain)}`);
    expect(u.body.user.role).toBe('user');
  });
});

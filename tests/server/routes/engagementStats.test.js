// The achievements page calls GET /engagement/stats, which did not exist, so
// every user saw the zero state. The connection + in-memory DB are owned by
// tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('GET /api/engagement/stats', () => {
  it('returns the caller\'s achievements, streak, counts and level', async () => {
    await User.deleteMany({ email: 'engagement-stats@example.com' });
    const user = await new User({ email: 'engagement-stats@example.com', password: 'password123', name: 'E', emailVerified: true }).save();
    await Content.create({ userId: String(user._id), title: 'v', type: 'video', status: 'completed' });
    await Content.create({ userId: String(user._id), title: 'a', type: 'article', status: 'completed' });
    const token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });

    const res = await request(app).get('/api/engagement/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      achievements: { total: 0 },
      streak: { currentStreak: 0 },
      stats: { totalContent: 2, totalVideos: 1, totalScripts: 0 },
    });
    expect(typeof res.body.data.level).toBe('number');
  });

  it('requires sign-in', async () => {
    expect((await request(app).get('/api/engagement/stats')).status).toBe(401);
  });
});

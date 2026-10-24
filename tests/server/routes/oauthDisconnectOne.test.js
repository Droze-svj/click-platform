// Disconnecting ONE social account must leave the others connected. The
// per-platform routers (routes/oauth/<platform>.js) used to register their own
// DELETE /disconnect ahead of the multi-account handler in routes/oauth.js and
// ignored `accountId`, so one click removed every account on the platform
// (Instagram removed the first account instead of the chosen one).
// The connection + in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

// (google is not declared under User.oauth, so it cannot be seeded here.)
const PLATFORMS = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];

describe('DELETE /api/oauth/:platform/disconnect', () => {
  let user;
  let token;

  const twoAccounts = () => ({
    connected: true,
    activeAccountId: 'acc-1',
    platformUserId: 'pu-1',
    accounts: [
      { accountId: 'acc-1', platformUserId: 'pu-1', platformUsername: 'one', isPrimary: true },
      { accountId: 'acc-2', platformUserId: 'pu-2', platformUsername: 'two', isPrimary: false },
    ],
  });

  beforeEach(async () => {
    await User.deleteMany({ email: 'oauth-disconnect@example.com' });
    const oauth = {};
    for (const p of PLATFORMS) oauth[p] = twoAccounts();
    user = await new User({ email: 'oauth-disconnect@example.com', password: 'password123', name: 'O', emailVerified: true, oauth }).save();
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const del = (platform, body) => request(app)
    .delete(`/api/oauth/${platform}/disconnect`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

  test.each(PLATFORMS)('%s: removes only the chosen account', async (platform) => {
    const res = await del(platform, { accountId: 'acc-2' });
    expect(res.status).toBe(200);
    const saved = await User.findById(user._id).lean();
    expect(saved.oauth[platform].accounts.map((a) => a.accountId)).toEqual(['acc-1']);
  });

  test('without an accountId every account on that platform is removed (and only that platform)', async () => {
    const res = await del('instagram', {});
    expect(res.status).toBe(200);
    const saved = await User.findById(user._id).lean();
    expect(saved.oauth.instagram.accounts).toEqual([]);
    expect(saved.oauth.twitter.accounts).toHaveLength(2);
  });
});

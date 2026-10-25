// /user/settings: third-party keys are never returned in plaintext and are
// kept when a save doesn't re-send them; notifications/privacy/agentic saves
// merge field by field instead of replacing the whole sub-object.
// The connection + in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const UserSettings = require('../../../server/models/UserSettings');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { decryptToken } = require('../../../server/utils/dataEncryption');

describe('/api/user/settings', () => {
  let user;
  let token;

  beforeEach(async () => {
    await User.deleteMany({ email: 'settings-merge@example.com' });
    user = await new User({ email: 'settings-merge@example.com', password: 'password123', name: 'S', emailVerified: true }).save();
    await UserSettings.deleteMany({ userId: String(user._id) });
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const put = (body) => request(app).put('/api/user/settings').set('Authorization', `Bearer ${token}`).send(body);
  const get = () => request(app).get('/api/user/settings').set('Authorization', `Bearer ${token}`);

  it('masks the HeyGen/Sora keys and keeps them when a save omits them', async () => {
    const first = await put({ agentic: { digitalTwinProvider: 'heygen', heygenApiKey: 'hg_secret_value_1234' } });
    expect(first.status).toBe(200);
    expect(JSON.stringify(first.body)).not.toContain('hg_secret_value_1234');

    const read = await get();
    expect(read.body.data.agentic).toMatchObject({ heygenApiKeySet: true, heygenApiKeyLast4: '1234', soraApiKeySet: false, digitalTwinProvider: 'heygen' });
    expect(read.body.data.agentic.heygenApiKey).toBeUndefined();
    expect(JSON.stringify(read.body)).not.toContain('hg_secret_value_1234');

    // The client never has the key, so its next save sends none (or an empty one).
    await put({ agentic: { autonomousSwarm: false, heygenApiKey: '' } });
    const stored = await UserSettings.findOne({ userId: String(user._id) }).lean();
    // Encrypted at rest (see agenticKeysEncrypted.test.js), same key inside.
    expect(decryptToken(stored.agentic.heygenApiKey)).toBe('hg_secret_value_1234');
    expect(stored.agentic.autonomousSwarm).toBe(false);
    expect(stored.agentic.digitalTwinProvider).toBe('heygen');

    await put({ agentic: { heygenApiKey: null } });
    expect((await UserSettings.findOne({ userId: String(user._id) }).lean()).agentic.heygenApiKey).toBe('');
  });

  it('merges notifications field by field', async () => {
    await put({ notifications: { weeklyDigest: true, digestMode: 'daily', categories: { task: false } } });
    await put({ notifications: { email: false } });
    const n = (await get()).body.data.notifications;
    expect(n).toMatchObject({ email: false, weeklyDigest: true, digestMode: 'daily' });
    expect(n.categories.task).toBe(false);
    expect(n.categories.project).toBe(true);
  });

  it('ignores invalid notification values instead of storing them', async () => {
    await put({ notifications: { digestMode: 'hourly', email: 'yes', digestTime: '25:99' } });
    const n = (await get()).body.data.notifications;
    expect(n.digestMode).toBe('immediate');
    expect(n.email).toBe(true);
    expect(n.digestTime).toBe('09:00');
  });
});

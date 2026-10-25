// HeyGen / Sora API keys (UserSettings.agentic) were stored in plaintext. They
// are now encrypted at rest in the OAuth-token format (enc:v1:), still masked
// on GET, decrypted where digitalTwinService uses them — and a plaintext key
// saved before this keeps working and is re-encrypted by the next save.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const UserSettings = require('../../../server/models/UserSettings');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { decryptToken } = require('../../../server/utils/dataEncryption');
const digitalTwinService = require('../../../server/services/digitalTwinService');

describe('agentic API keys at rest', () => {
  let user;
  let token;
  const rawRow = () => UserSettings.collection.findOne({ userId: String(user._id) });

  beforeEach(async () => {
    await User.deleteMany({ email: 'agentic-keys@example.com' });
    user = await new User({ email: 'agentic-keys@example.com', password: 'password123', name: 'Key Tester', emailVerified: true }).save();
    await UserSettings.deleteMany({ userId: String(user._id) });
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  it('stores a saved key encrypted, masks it on GET, and hands digitalTwinService the real key', async () => {
    const put = await auth(request(app).put('/api/user/settings')).send({ agentic: { heygenApiKey: 'hg_live_secret_12345678' } });
    expect(put.status).toBe(200);
    expect(JSON.stringify(put.body)).not.toContain('hg_live_secret');

    const row = await rawRow();
    expect(row.agentic.heygenApiKey).toMatch(/^enc:v1:/);
    expect(row.agentic.heygenApiKey).not.toContain('hg_live_secret');
    expect(decryptToken(row.agentic.heygenApiKey)).toBe('hg_live_secret_12345678');

    const got = await auth(request(app).get('/api/user/settings'));
    const agentic = (got.body.data ?? got.body).agentic;
    expect(agentic).toEqual(expect.objectContaining({ heygenApiKeySet: true, heygenApiKeyLast4: '5678', soraApiKeySet: false }));
    expect(JSON.stringify(got.body)).not.toContain('hg_live_secret');
    expect(JSON.stringify(got.body)).not.toContain('enc:v1:');

    const settings = await digitalTwinService.resolveUserSettings(String(user._id));
    expect(settings.agentic.heygenApiKey).toBe('hg_live_secret_12345678');
  });

  it('a legacy plaintext key keeps working and the next save encrypts it', async () => {
    // Written straight to the collection, as rows from before encryption are.
    await UserSettings.collection.insertOne({ userId: String(user._id), agentic: { soraApiKey: 'sora_legacy_key_abcd1234' } });

    const got = await auth(request(app).get('/api/user/settings'));
    expect((got.body.data ?? got.body).agentic).toEqual(expect.objectContaining({ soraApiKeySet: true, soraApiKeyLast4: '1234' }));
    expect((await digitalTwinService.resolveUserSettings(String(user._id))).agentic.soraApiKey).toBe('sora_legacy_key_abcd1234');

    // Any settings save — here an unrelated appearance change.
    await auth(request(app).put('/api/user/settings')).send({ appearance: { density: 'compact' } }).expect(200);
    const row = await rawRow();
    expect(row.agentic.soraApiKey).toMatch(/^enc:v1:/);
    expect(decryptToken(row.agentic.soraApiKey)).toBe('sora_legacy_key_abcd1234');
    expect((await digitalTwinService.resolveUserSettings(String(user._id))).agentic.soraApiKey).toBe('sora_legacy_key_abcd1234');
  });

  it('null still clears a key', async () => {
    await auth(request(app).put('/api/user/settings')).send({ agentic: { soraApiKey: 'sora_to_be_cleared_9999' } }).expect(200);
    await auth(request(app).put('/api/user/settings')).send({ agentic: { soraApiKey: null } }).expect(200);
    expect((await rawRow()).agentic.soraApiKey).toBe('');
  });
});

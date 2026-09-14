// Mongoose sub-schemas are STRICT: a path the schema does not declare is dropped
// on save, silently and without error. User.oauth.<platform> declared
// accounts[]/activeAccountId for `twitter` only, so for the other five platforms
// every multi-account write from OAuthStorage.saveTokens() was discarded.
//
// It hid well: loadTokens() synthesises accounts[] from the legacy single-blob
// shape, and accessToken/refreshToken ARE declared, so connecting ONE account
// kept working. Connecting a SECOND account of the same platform reported
// success and then wasn't there.
//
// `states` was undeclared on every platform, which made
// OAuthStorage.putState/consumeState a no-op on the Mongo backend — the default
// (getProvider() only returns 'supabase' with ENABLE_SUPABASE_AUTH === 'true').
//
// Behavioural on purpose: these assert that data written comes back, which is
// the only thing that actually distinguishes a strict-mode drop from a save.

const OAuthStorage = require('../../server/utils/oauthStorage');
const User = require('../../server/models/User');

// google maps onto the `youtube` sub-schema (see _readMongoPlatform).
const PLATFORMS = ['twitter', 'linkedin', 'facebook', 'youtube', 'tiktok', 'instagram'];

describe('OAuthStorage persists what it writes on the Mongo backend', () => {
  let user;

  beforeEach(async () => {
    user = await User.create({
      email: 'oauth-storage@example.com',
      password: 'password123',
      name: 'Storage',
      emailVerified: true,
    });
  });

  afterEach(async () => {
    await User.deleteMany({ email: 'oauth-storage@example.com' });
  });

  it('uses the Mongo backend unless Supabase auth is explicitly enabled', () => {
    // If this flips, the tests below stop covering the default deployment.
    expect(OAuthStorage.getProvider()).toBe('mongoose');
  });

  test.each(PLATFORMS)('%s: a second account is actually stored', async (platform) => {
    const id = String(user._id);

    await OAuthStorage.saveTokens(id, platform, {
      platformUserId: 'acct-1',
      platformUsername: 'first',
      accessToken: 'token-1',
    });
    await OAuthStorage.saveTokens(id, platform, {
      platformUserId: 'acct-2',
      platformUsername: 'second',
      accessToken: 'token-2',
    });

    const accounts = await OAuthStorage.listAccounts(id, platform);
    expect(accounts.map((a) => a.platformUserId).sort()).toEqual(['acct-1', 'acct-2']);
  });

  test.each(PLATFORMS)('%s: an in-flight state round-trips and is single-use', async (platform) => {
    const id = String(user._id);

    await OAuthStorage.putState(id, platform, 'state-abc', { startedAt: 'now' });

    // Verifies the state survived the save — a dropped path returns false here.
    expect(await OAuthStorage.consumeState(id, platform, 'state-abc')).toBe(true);
    // Consumed, so a replayed authorization code cannot reuse it.
    expect(await OAuthStorage.consumeState(id, platform, 'state-abc')).toBe(false);
  });

  test.each(PLATFORMS)('%s: two concurrent flows do not clobber each other', async (platform) => {
    const id = String(user._id);

    await OAuthStorage.putState(id, platform, 'state-one');
    await OAuthStorage.putState(id, platform, 'state-two');

    expect(await OAuthStorage.consumeState(id, platform, 'state-one')).toBe(true);
    expect(await OAuthStorage.consumeState(id, platform, 'state-two')).toBe(true);
  });
});

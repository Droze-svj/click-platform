// Google OAuth data must persist on MongoDB users. `oauth.google` wasn't in the
// schema, so strict mode dropped the tokens and the in-flight OAuth state.
const User = require('../../../server/models/User');

describe('User.oauth.google', () => {
  it('keeps Google tokens, accounts and OAuth states', async () => {
    const u = await new User({ email: `g-${Date.now()}@example.com`, password: 'password123', name: 'G' }).save();
    await User.updateOne({ _id: u._id }, { $set: {
      'oauth.google.connected': true,
      'oauth.google.accounts': [{ id: 'g1', accessToken: 'enc' }],
      'oauth.google.states': { abc: { createdAt: Date.now() } },
    } });
    const saved = await User.findById(u._id).lean();
    expect(saved.oauth.google.connected).toBe(true);
    expect(saved.oauth.google.accounts[0].id).toBe('g1');
    expect(saved.oauth.google.states.abc).toBeDefined();
  });
});

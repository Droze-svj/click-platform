// A niche changed anywhere must reach what the AI reads:
// UserPreferences.marketingIntelligence.niche, resolved by the marketing brain.
//
// Settings → Profile and the niche picker wrote only User.niche; the onboarding
// wizard / editor wrote only marketingIntelligence.niche (and the wizard sent
// creator types like "educator" that resolve to the generic 'other' playbook).
// marketingIntelligence.niche also defaults to 'General', so the brain's
// User.niche fallback never ran, and its string-only id lookup missed every
// preferences doc keyed by an ObjectId.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const UserPreferences = require('../../../server/models/UserPreferences');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { resolveContext } = require('../../../server/services/marketingBrainService');
const { normaliseNiche } = require('../../../server/services/marketingKnowledge');

describe('niche changes reach the AI', () => {
  let user;
  let token;

  beforeEach(async () => {
    await User.deleteMany({ email: 'niche-sync@example.com' });
    user = await new User({ email: 'niche-sync@example.com', password: 'password123', name: 'Niche Tester', emailVerified: true }).save();
    await UserPreferences.deleteMany({ userId: { $in: [user._id, String(user._id)] } });
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const miNiche = async () => {
    const docs = await UserPreferences.find({ userId: { $in: [user._id, String(user._id)] } }).lean();
    expect(docs).toHaveLength(1);
    return docs[0].marketingIntelligence?.niche;
  };

  it('Settings → Profile niche change is mirrored to marketingIntelligence', async () => {
    const res = await auth(request(app).put('/api/auth/profile')).send({ niche: 'technology' });
    expect(res.status).toBe(200);
    expect(await miNiche()).toBe('technology');
    expect((await resolveContext({ userId: user._id })).niche).toBe('technology');
  });

  it('the niche picker (PUT /niche/select) is mirrored too, onto an existing ObjectId-keyed doc', async () => {
    await UserPreferences.create({ userId: user._id, marketingIntelligence: { niche: 'General' } });
    const res = await auth(request(app).put('/api/niche/select')).send({ niche: 'gaming' });
    expect(res.status).toBe(200);
    expect(await miNiche()).toBe('gaming');
    expect((await resolveContext({ userId: String(user._id) })).niche).toBe('gaming');
  });

  it('onboarding (PUT /me/ai-preferences) resolves the niche and mirrors it to User.niche', async () => {
    const res = await auth(request(app).put('/api/me/ai-preferences')).send({
      defaults: { niche: 'fitness', goals: ['viral'] },
    });
    expect(res.status).toBe(200);
    expect(await miNiche()).toBe('health');
    expect((await User.findById(user._id).lean()).niche).toBe('health');
    const ctx = await resolveContext({ userId: user._id });
    expect(ctx.niche).toBe('health');
    expect(ctx.goals).toEqual(['more_views']);
  });

  it('a niche with no playbook keeps the creator\'s words for the prompt', async () => {
    await auth(request(app).put('/api/me/ai-preferences')).send({ defaults: { niche: 'woodworking' } });
    expect(await miNiche()).toBe('woodworking');
    expect((await User.findById(user._id).lean()).niche).toBe('other');
  });

  it('the default "General" no longer hides User.niche from the brain', async () => {
    await User.updateOne({ _id: user._id }, { $set: { niche: 'beauty' } });
    await UserPreferences.create({ userId: String(user._id) });
    expect((await resolveContext({ userId: user._id })).niche).toBe('beauty');
  });

  it('normaliseNiche maps common words and labels to playbooks', () => {
    expect(normaliseNiche('Finance & Investing')).toBe('finance');
    expect(normaliseNiche('tech')).toBe('technology');
    expect(normaliseNiche('educator')).toBe('education');
    expect(normaliseNiche('mental health')).toBe('wellness');
    expect(normaliseNiche('General')).toBe('other');
    expect(normaliseNiche('underwater basket weaving')).toBe('other');
  });
});

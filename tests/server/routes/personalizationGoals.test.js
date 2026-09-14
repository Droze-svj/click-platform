// Onboarding captures niche, platform and creator goal. Those answers used to
// be written to localStorage only, so they never reached the server — and
// `marketingIntelligence.goals` existed on the model with no API path to write
// it at all, so the marketing brain could never see the creator's objective.

const request = require('supertest');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const UserPreferences = require('../../../server/models/UserPreferences');
const jwt = require('jsonwebtoken');

const tokenFor = (user) =>
  jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

describe('PUT /api/me/ai-preferences — onboarding answers', () => {
  let user, token, other, otherToken;

  beforeAll(async () => {
    user = await User.create({
      email: 'goals-a@example.com', password: 'password123', name: 'Goals A', emailVerified: true,
    });
    other = await User.create({
      email: 'goals-b@example.com', password: 'password123', name: 'Goals B', emailVerified: true,
    });
    token = tokenFor(user);
    otherToken = tokenFor(other);
  });

  afterAll(async () => {
    await UserPreferences.deleteMany({});
    await User.deleteMany({ _id: { $in: [user._id, other._id] } });
  });

  it('persists niche, platformFocus and goals, and reads them back', async () => {
    await request(app)
      .put('/api/me/ai-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        voice: { hookStyle: 'controversial-question' },
        defaults: { niche: 'fitness', platformFocus: ['tiktok'], goals: ['viral'] },
      })
      .expect(200);

    const res = await request(app)
      .get('/api/me/ai-preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.defaults.niche).toBe('fitness');
    expect(data.defaults.platformFocus).toEqual(['tiktok']);
    // The field this test exists for — previously unwritable through the API.
    expect(data.defaults.goals).toEqual(['viral']);
    expect(data.voice.hookStyle).toBe('controversial-question');
  });

  it('reaches the model the marketing brain actually reads', async () => {
    // The route keys UserPreferences by req.user._id (an ObjectId), not its hex
    // string — see server/utils/userKey.js on why the ObjectId is canonical.
    const prefs = await UserPreferences.findOne({ userId: user._id }).lean();
    expect(prefs?.marketingIntelligence?.goals).toEqual(['viral']);
    expect(prefs?.marketingIntelligence?.niche).toBe('fitness');
  });

  it('a partial save does not wipe the other onboarding answers', async () => {
    await request(app)
      .put('/api/me/ai-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ voice: { tone: 'warm' } })
      .expect(200);

    const res = await request(app)
      .get('/api/me/ai-preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const data = res.body.data ?? res.body;
    expect(data.defaults.goals).toEqual(['viral']);
    expect(data.defaults.niche).toBe('fitness');
    expect(data.voice.tone).toBe('warm');
  });

  it('does not leak one creator\'s answers to another', async () => {
    const res = await request(app)
      .get('/api/me/ai-preferences')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    const data = res.body.data ?? res.body;
    expect(data.defaults.goals).toEqual([]);
    expect(data.defaults.niche).not.toBe('fitness');
  });

  it('requires authentication', async () => {
    await request(app).put('/api/me/ai-preferences').send({ defaults: { goals: ['viral'] } }).expect(401);
  });
});

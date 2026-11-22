// GET /onboarding must say which steps are done. The client reads
// step.completed, but the steps were the static config with no completion
// (that lives in progress.completedSteps), so nothing ever showed as done.
// The connection + in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const OnboardingProgress = require('../../../server/models/OnboardingProgress');
const Content = require('../../../server/models/Content');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('GET /api/onboarding', () => {
  it('marks completed steps as completed', async () => {
    await User.deleteMany({ email: 'onboarding-steps@example.com' });
    const user = await new User({ email: 'onboarding-steps@example.com', password: 'password123', name: 'O', emailVerified: true }).save();
    await OnboardingProgress.deleteMany({ userId: user._id });
    const token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
    const authed = (r) => r.set('Authorization', `Bearer ${token}`);

    const before = await authed(request(app).get('/api/onboarding'));
    expect(before.status).toBe(200);
    expect(before.body.data.steps.every((s) => s.completed === false)).toBe(true);

    expect((await authed(request(app).post('/api/onboarding/complete-step')).send({ stepId: 'profile' })).status).toBe(200);

    const after = await authed(request(app).get('/api/onboarding'));
    const byId = Object.fromEntries(after.body.data.steps.map((s) => [s.id, s.completed]));
    expect(byId.profile).toBe(true);
    expect(byId.welcome).toBe(false);
  });

  it('counts what the creator already did elsewhere (niche, upload, connected account)', async () => {
    await User.deleteMany({ email: 'onboarding-earned@example.com' });
    const user = await new User({
      email: 'onboarding-earned@example.com', password: 'password123', name: 'E', emailVerified: true,
      niche: 'health',
      oauth: { youtube: { connected: true } },
    }).save();
    await OnboardingProgress.deleteMany({ userId: user._id });
    await Content.create({ userId: String(user._id), type: 'video', title: 'First upload', status: 'completed' });
    const token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });

    const res = await request(app).get('/api/onboarding').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.steps.map((s) => [s.id, s.completed]));
    expect(byId).toMatchObject({ welcome: true, profile: true, 'first-content': true, 'connect-social': true, complete: true });
    expect(byId.captions).toBe(false);
    expect(res.body.data.isComplete).toBe(true);
    // Each step a creator can act on links somewhere.
    const hrefs = Object.fromEntries(res.body.data.steps.map((s) => [s.id, s.href]));
    expect(hrefs['connect-social']).toBe('/dashboard/social');
    expect(hrefs['first-content']).toBe('/dashboard/video');

    // Persisted, not recomputed into a different answer next time.
    const saved = await OnboardingProgress.findOne({ userId: user._id }).lean();
    expect(saved.completedSteps.map((c) => c.stepId)).toEqual(expect.arrayContaining(['profile', 'first-content', 'connect-social']));
  });
});

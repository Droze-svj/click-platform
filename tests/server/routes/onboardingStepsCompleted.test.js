// GET /onboarding must say which steps are done. The client reads
// step.completed, but the steps were the static config with no completion
// (that lives in progress.completedSteps), so nothing ever showed as done.
// The connection + in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const OnboardingProgress = require('../../../server/models/OnboardingProgress');
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
});

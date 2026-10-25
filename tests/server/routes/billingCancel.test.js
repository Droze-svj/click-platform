// Self-service cancel must stop the renewal AT WHOP. It used to only flip the
// local status: "cancelled" on screen, still billed every month.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

jest.mock('../../../server/services/whopMonetizationService', () => ({
  ...jest.requireActual('../../../server/services/whopMonetizationService'),
  cancelWhopMembership: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { cancelWhopMembership } = require('../../../server/services/whopMonetizationService');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('POST /api/billing/cancel', () => {
  let user; let token;
  beforeEach(async () => {
    cancelWhopMembership.mockReset();
    await User.deleteMany({ email: 'cancel-test@example.com' });
    user = await new User({
      email: 'cancel-test@example.com', password: 'password123', name: 'C', emailVerified: true,
      subscription: { status: 'active', plan: 'creator', whopSubscriptionId: 'mem_abc123', endDate: new Date(Date.now() + 5 * 86400000) },
    }).save();
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  it('cancels the Whop membership at period end, then marks the account', async () => {
    const periodEnd = new Date(Date.now() + 9 * 86400000).toISOString();
    cancelWhopMembership.mockResolvedValue({ success: true, configured: true, membership: { status: 'active', renewal_period_end: periodEnd } });
    const res = await request(app).post('/api/billing/cancel').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(200);
    expect(cancelWhopMembership).toHaveBeenCalledWith('mem_abc123');
    const saved = await User.findById(user._id).lean();
    expect(saved.subscription.status).toBe('cancelled');
    expect(saved.subscription.cancelledAt).toBeInstanceOf(Date);
    expect(saved.subscription.endDate.toISOString()).toBe(periodEnd);
  });

  it('does not claim success when Whop did not cancel', async () => {
    cancelWhopMembership.mockResolvedValue({ success: false, configured: false, reason: 'no key' });
    const res = await request(app).post('/api/billing/cancel').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/whop\.com\/hub/);
    expect((await User.findById(user._id).lean()).subscription.status).toBe('active');
  });
});

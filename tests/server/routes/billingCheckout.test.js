// POST /api/billing/checkout: a Whop checkout tied to the account (user id in
// Whop metadata) when WHOP_API_KEY is set; otherwise { url: null } and the
// client falls back to the plan's plain checkout link.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

jest.mock('../../../server/services/whopMonetizationService', () => ({
  ...jest.requireActual('../../../server/services/whopMonetizationService'),
  createWhopCheckout: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { createWhopCheckout } = require('../../../server/services/whopMonetizationService');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('POST /api/billing/checkout', () => {
  let token; let user;
  const prevPlan = process.env.WHOP_PRODUCT_ID_PRO_MONTHLY;
  afterAll(() => { if (prevPlan === undefined) delete process.env.WHOP_PRODUCT_ID_PRO_MONTHLY; else process.env.WHOP_PRODUCT_ID_PRO_MONTHLY = prevPlan; });
  beforeAll(async () => {
    user = await new User({ email: `checkout-${Date.now()}@example.com`, password: 'password123', name: 'C', emailVerified: true }).save();
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
    process.env.WHOP_PRODUCT_ID_PRO_MONTHLY = 'plan_testProMonthly';
  });
  const post = (body) => request(app).post('/api/billing/checkout').set('Authorization', `Bearer ${token}`).send(body);

  it('creates a checkout carrying the user id for a known plan', async () => {
    createWhopCheckout.mockResolvedValueOnce({ success: true, purchaseUrl: 'https://whop.com/checkout/ch_1/' });
    const res = await post({ planId: 'pro', period: 'monthly' });
    expect(res.status).toBe(200);
    expect(res.body.data.url).toBe('https://whop.com/checkout/ch_1/');
    expect(createWhopCheckout).toHaveBeenCalledWith(expect.objectContaining({ whopPlanId: 'plan_testProMonthly', userId: user._id }));
  });

  it('returns url null when Whop can\'t create one, and 400 for an unknown plan', async () => {
    createWhopCheckout.mockResolvedValueOnce({ success: false, configured: false });
    expect((await post({ planId: 'pro', period: 'monthly' })).body.data.url).toBeNull();
    expect((await post({ planId: 'gold', period: 'monthly' })).status).toBe(400);
  });
});

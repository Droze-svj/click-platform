// POST /api/billing/upgrade is a QUOTE. It used to claim a use of the promo
// code and save a 'pending' SubscriptionChange with no checkout behind it —
// nothing ever completed that row (paid tiers come only from the signed Whop
// webhook), so each call burned a single-use code and added a phantom plan
// change to billing history.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const PromoCode = require('../../../server/models/PromoCode');
const SubscriptionChange = require('../../../server/models/SubscriptionChange');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('POST /api/billing/upgrade has no side effects', () => {
  let user;
  let token;

  beforeEach(async () => {
    await User.deleteMany({ email: 'upgrade-quote@example.com' });
    await PromoCode.deleteMany({ code: 'ONCE20' });
    user = await new User({ email: 'upgrade-quote@example.com', password: 'password123', name: 'Quote Tester', emailVerified: true }).save();
    await SubscriptionChange.deleteMany({ userId: user._id });
    await PromoCode.create({ code: 'ONCE20', discountType: 'percentage', discountValue: 20, maxUses: 1, usedCount: 0, isActive: true });
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  it('quotes the discount without redeeming the code or recording a change', async () => {
    for (let i = 0; i < 2; i++) {
      const res = await auth(request(app).post('/api/billing/upgrade')).send({ planId: 'pro', promoCode: 'ONCE20' });
      expect(res.status).toBe(200);
      const data = res.body.data ?? res.body;
      expect(data.checkoutRequired).toBe(true);
      expect(data.promoCode).toEqual(expect.objectContaining({ valid: true }));
      expect(data.breakdown.discountAmount).toBeGreaterThan(0);
      expect(data.subscriptionChange).toBeUndefined();
    }

    expect((await PromoCode.findOne({ code: 'ONCE20' }).lean()).usedCount).toBe(0);
    expect(await SubscriptionChange.countDocuments({ userId: user._id })).toBe(0);
    // The user's plan is untouched.
    expect((await User.findById(user._id).lean()).subscription?.plan).not.toBe('pro');
  });

  it('404s an unknown plan instead of 500', async () => {
    const res = await auth(request(app).post('/api/billing/upgrade')).send({ planId: 'platinum-ultra' });
    expect(res.status).toBe(404);
  });
});

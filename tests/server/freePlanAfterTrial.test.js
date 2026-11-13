// The pricing page promises a Free plan "forever" with limits. New accounts
// start on a 14-day trial; when it ended, the upload/generation gates refused
// the account outright ("Your subscription has expired") instead of dropping it
// to Free, whose limits the entitlement layer enforces. Premium gates must still
// refuse a Free account.

const { checkActiveSubscription, requirePremiumSubscription } = require('../../server/middleware/subscriptionAccess');

const DAY = 24 * 60 * 60 * 1000;
const req = (subscription) => ({ headers: { host: 'click.example' }, user: { _id: 'u1', subscription } });

describe('Free plan after the trial', () => {
  it('lets an account whose trial ended keep using the Free plan', () => {
    const r = checkActiveSubscription(req({ status: 'trial', plan: 'free', endDate: new Date(Date.now() - DAY) }));
    expect(r.ok).toBe(true);
  });

  it('lets a lapsed paid plan fall back to Free', () => {
    const r = checkActiveSubscription(req({ status: 'cancelled', plan: 'pro', endDate: new Date(Date.now() - DAY) }));
    expect(r.ok).toBe(true);
  });

  it('still keeps a Free account out of premium-only features', () => {
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    const next = jest.fn();
    const r = req({ status: 'trial', plan: 'free', endDate: new Date(Date.now() - DAY) });
    r.user.membershipPackage = { slug: 'free' };
    requirePremiumSubscription(r, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

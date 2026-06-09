// Tests for resolveTier cancellation/expiry grace semantics.
// Active subs keep access; cancelled/expired subs keep access until endDate
// (grace), then drop to free; trials and legacy aliases unchanged.

const { resolveTier } = require('../../../server/config/entitlements');

const NOW = new Date('2026-06-15T00:00:00Z').getTime();
const PAST = '2026-06-01T00:00:00Z';   // before NOW
const FUTURE = '2026-07-01T00:00:00Z'; // after NOW

describe('resolveTier — cancellation / expiry grace', () => {
  it('active paid plan resolves to that plan', () => {
    expect(resolveTier({ subscription: { plan: 'pro', status: 'active' } }, NOW)).toBe('pro');
    expect(resolveTier({ subscription: { plan: 'agency', status: 'active' } }, NOW)).toBe('agency');
  });

  it('cancelled but still within the paid period keeps access (grace)', () => {
    expect(resolveTier({ subscription: { plan: 'pro', status: 'cancelled', endDate: FUTURE } }, NOW)).toBe('pro');
  });

  it('cancelled and past period end drops to free', () => {
    expect(resolveTier({ subscription: { plan: 'pro', status: 'cancelled', endDate: PAST } }, NOW)).toBe('free');
  });

  it('expired and past period end drops to free', () => {
    expect(resolveTier({ subscription: { plan: 'agency', status: 'expired', endDate: PAST } }, NOW)).toBe('free');
  });

  it('cancelled with NO endDate keeps access (unknown end — do not revoke blindly)', () => {
    expect(resolveTier({ subscription: { plan: 'pro', status: 'cancelled' } }, NOW)).toBe('pro');
  });

  it('active plan with a past endDate still resolves (active overrides)', () => {
    // Only cancelled/expired statuses trigger the grace-expiry downgrade.
    expect(resolveTier({ subscription: { plan: 'pro', status: 'active', endDate: PAST } }, NOW)).toBe('pro');
  });

  it('trial (not expired) → pro; expired trial → free', () => {
    expect(resolveTier({ subscription: { status: 'trial', endDate: FUTURE } }, NOW)).toBe('pro');
    expect(resolveTier({ subscription: { status: 'trial', endDate: PAST } }, NOW)).toBe('free');
  });

  it('legacy monthly/annual → pro; no sub → free', () => {
    expect(resolveTier({ subscription: { plan: 'monthly' } }, NOW)).toBe('pro');
    expect(resolveTier({ subscription: { plan: 'annual' } }, NOW)).toBe('pro');
    expect(resolveTier({}, NOW)).toBe('free');
    expect(resolveTier(null, NOW)).toBe('free');
  });
});

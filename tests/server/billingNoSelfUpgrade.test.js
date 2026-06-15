// Regression for the critical self-upgrade hole: POST /api/billing/upgrade then
// POST /api/billing/change/:id/complete with fake payment ids used to flip the
// user to Pro for free (completeSubscriptionChange granted the tier without any
// provider verification). The route is now retired (410) and the service
// function is hard-disabled so no caller can reintroduce an unverified grant.
// Paid entitlements are granted ONLY by the signed Whop webhook.

const billingService = require('../../server/services/billingService');

describe('billing — self-upgrade is closed', () => {
  test('completeSubscriptionChange refuses to grant (throws "disabled")', async () => {
    await expect(
      billingService.completeSubscriptionChange('anyChangeId', 'pi_fake', 'inv_fake')
    ).rejects.toThrow(/disabled/i);
  });

  test('it never touches the DB / mutates a user (throws before any work)', async () => {
    // Called with no args at all — if it still tried to grant it would throw a
    // different ("not found") error; the disabled guard must fire first.
    await expect(billingService.completeSubscriptionChange()).rejects.toThrow(/disabled/i);
  });
});

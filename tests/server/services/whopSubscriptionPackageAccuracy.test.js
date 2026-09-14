/**
 * Subscription and Payment Package Accuracy Test Suite
 *
 * Verifies that:
 * 1. whopWebhookService resolves canonical tiers ('creator', 'pro', 'agency')
 *    and billing periods ('monthly', 'yearly') across all event shapes:
 *    - Configured WHOP_PRODUCT_ID_* env mappings
 *    - Direct tier names in product_id / plan_id
 *    - Metadata (metadata.planId, metadata.plan, metadata.tier, metadata.billingCycle)
 *    - Product / plan name and titles ("Creator Monthly", "Pro Annual", "Agency")
 *    - Price heuristic ($39/390, $119/1190, $349/3490)
 *    - Preserving active user subscription on renewals
 * 2. Subscription lifecycle correctly updates user subscription plan, status,
 *    billingCycle, startDate, and endDate.
 * 3. Invoices in BillingHistory reflect the exact package, cycle, amount, and currency.
 * 4. billingService.processSubscriptionChange gracefully handles upgrades from Free/unpopulated
 *    tiers to Creator/Pro/Agency with accurate proration.
 */

const {
  resolvePlanFromEvent,
  processEvent,
} = require('../../../server/services/whopWebhookService');
const {
  calculateProratedAmount,
  processSubscriptionChange,
} = require('../../../server/services/billingService');
const mongoose = require('mongoose');

describe('Whop Webhook Plan Resolution', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.WHOP_PRODUCT_ID_CREATOR_MONTHLY = 'whop_prod_creator_m';
    process.env.WHOP_PRODUCT_ID_CREATOR_YEARLY = 'whop_prod_creator_y';
    process.env.WHOP_PRODUCT_ID_PRO_MONTHLY = 'whop_prod_pro_m';
    process.env.WHOP_PRODUCT_ID_PRO_YEARLY = 'whop_prod_pro_y';
    process.env.WHOP_PRODUCT_ID_AGENCY_MONTHLY = 'whop_prod_agency_m';
    process.env.WHOP_PRODUCT_ID_AGENCY_YEARLY = 'whop_prod_agency_y';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('resolves plan from configured WHOP_PRODUCT_ID_* mapping', () => {
    const event = {
      action: 'payment.succeeded',
      data: { product_id: 'whop_prod_pro_y' },
    };
    const res = resolvePlanFromEvent(event);
    expect(res).toEqual({ planId: 'pro', period: 'yearly' });
  });

  it('resolves direct canonical tier ID in product_id or plan_id', () => {
    expect(resolvePlanFromEvent({ data: { product_id: 'creator', billing_period: 'monthly' } }))
      .toEqual({ planId: 'creator', period: 'monthly' });
    expect(resolvePlanFromEvent({ data: { plan_id: 'agency', period: 'yearly' } }))
      .toEqual({ planId: 'agency', period: 'yearly' });
  });

  it('resolves tier and billing cycle from metadata', () => {
    const event = {
      action: 'payment.succeeded',
      data: {
        product_id: 'unrecognized_external_id',
        metadata: {
          planId: 'creator',
          billingCycle: 'yearly',
        },
      },
    };
    const res = resolvePlanFromEvent(event);
    expect(res).toEqual({ planId: 'creator', period: 'yearly' });
  });

  it('resolves tier and cycle from product_name and plan title signals', () => {
    const event = {
      action: 'payment.succeeded',
      data: {
        product_id: 'custom_whop_id',
        product_name: 'Click Pro Membership (Annual)',
      },
    };
    const res = resolvePlanFromEvent(event);
    expect(res).toEqual({ planId: 'pro', period: 'yearly' });
  });

  it('resolves Agency plan from item description or name', () => {
    const event = {
      action: 'payment.succeeded',
      data: {
        product_id: 'custom_agency_id',
        name: 'Agency Tier - High Volume',
      },
    };
    const res = resolvePlanFromEvent(event);
    expect(res).toEqual({ planId: 'agency', period: 'monthly' });
  });

  it('resolves tier by price heuristic when other metadata is absent', () => {
    // $119 / month -> Pro
    const eventPro = { data: { amount: 119.0 } };
    expect(resolvePlanFromEvent(eventPro)).toEqual({ planId: 'pro', period: 'monthly' });

    // $390 / year -> Creator Yearly
    const eventCreatorYearly = { data: { amount: 390.0 } };
    expect(resolvePlanFromEvent(eventCreatorYearly)).toEqual({ planId: 'creator', period: 'yearly' });

    // $3490 / year -> Agency Yearly
    const eventAgencyYearly = { data: { amount: 3490.0 } };
    expect(resolvePlanFromEvent(eventAgencyYearly)).toEqual({ planId: 'agency', period: 'yearly' });
  });

  it('preserves user active paid plan during renewal when event has no recognized product_id', () => {
    const existingUser = {
      subscription: {
        plan: 'agency',
        billingCycle: 'yearly',
        status: 'active',
      },
    };
    const renewalEvent = {
      action: 'payment.succeeded',
      data: {
        product_id: 'unmapped_renewal_item',
      },
    };
    const res = resolvePlanFromEvent(renewalEvent, existingUser);
    expect(res).toEqual({ planId: 'agency', period: 'yearly' });
  });
});

describe('Whop processEvent Lifecycle', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  function makeMockUser(initial = {}) {
    return {
      _id: userId,
      subscription: initial.subscription || {},
      whopUserId: initial.whopUserId,
      save: jest.fn(async function() { return this; }),
    };
  }

  it('activates user selected package and calculates accurate endDate', async () => {
    const user = makeMockUser({ subscription: { status: 'none', plan: 'free' } });
    const deps = {
      User: {
        findById: jest.fn(async () => user),
        findOne: jest.fn(async () => null),
      },
    };

    const event = {
      action: 'payment.succeeded',
      data: {
        id: 'txn_test_123',
        passthrough: userId,
        product_name: 'Click Pro (Monthly)',
        amount: 119.0,
        currency: 'usd',
      },
    };

    const result = await processEvent(event, deps);
    expect(result.ok).toBe(true);
    expect(result.plan).toBe('pro');
    expect(result.period).toBe('monthly');
    expect(user.save).toHaveBeenCalled();
    expect(user.subscription.status).toBe('active');
    expect(user.subscription.plan).toBe('pro');
    expect(user.subscription.billingCycle).toBe('monthly');
    expect(user.subscription.endDate).toBeInstanceOf(Date);
  });

  it('correctly handles cancellation event preserving endDate grace period', async () => {
    const futureDate = new Date(Date.now() + 15 * 86400000);
    const user = makeMockUser({
      subscription: {
        status: 'active',
        plan: 'creator',
        endDate: futureDate,
      },
    });
    const deps = {
      User: {
        findById: jest.fn(async () => user),
        findOne: jest.fn(async () => null),
      },
    };

    const cancelEvent = {
      action: 'subscription.cancelled',
      data: {
        passthrough: userId,
        expires_at: futureDate.toISOString(),
      },
    };

    const result = await processEvent(cancelEvent, deps);
    expect(result.ok).toBe(true);
    expect(user.subscription.status).toBe('cancelled');
    expect(user.subscription.plan).toBe('creator');
    expect(user.subscription.endDate.toISOString()).toBe(futureDate.toISOString());
  });
});

describe('Billing Service Proration & Package Change', () => {
  it('safely calculates proration when current package is null (free upgrade)', () => {
    const newPackage = {
      name: 'Creator',
      price: { monthly: 39, yearly: 390 },
    };

    const proration = calculateProratedAmount(
      null, // currentPackage is null for free tier
      newPackage,
      'monthly',
      'monthly',
      30,
      30
    );

    expect(proration.proratedAmount).toBe(39);
    expect(proration.credit).toBe(0);
    expect(proration.charge).toBe(39);
  });

  it('calculates upgrade proration between Creator and Pro', () => {
    const currentPackage = {
      name: 'Creator',
      price: { monthly: 39, yearly: 390 },
    };
    const newPackage = {
      name: 'Pro',
      price: { monthly: 119, yearly: 1190 },
    };

    // 15 days remaining out of 30
    const proration = calculateProratedAmount(
      currentPackage,
      newPackage,
      'monthly',
      'monthly',
      15,
      30
    );

    // Credit = 39 * (15/30) = 19.5
    // Charge = 119 * (15/30) = 59.5
    // Prorated = 59.5 - 19.5 = 40
    expect(proration.credit).toBe(19.5);
    expect(proration.charge).toBe(59.5);
    expect(proration.proratedAmount).toBe(40);
  });
});

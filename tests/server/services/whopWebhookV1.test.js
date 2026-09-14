/**
 * Whop v1 webhooks — signature scheme, payload shape, plan and period resolution.
 *
 * Every real Whop webhook was being rejected or ignored, in four independent ways:
 *   1. Whop signs with Standard Webhooks headers (webhook-id / -timestamp /
 *      -signature, `v1,<base64>` over `id.timestamp.body`); Click checked a hex
 *      HMAC in an x-whop-signature header Whop never sends → 401 for everything.
 *   2. The buyer is nested at data.user.{id,email}; Click read flat fields → no user.
 *   3. The plan is nested at data.plan.id; Click matched a product id first, so a
 *      product's monthly and yearly plans could not both resolve correctly.
 *   4. v1 renamed membership went_valid/went_invalid → activated/deactivated.
 * Also: any unrecognised paid event used to grant Pro.
 */

jest.mock('../../../server/models/BillingHistory', () => ({
  findOne: () => ({ select: () => ({ lean: async () => null }) }),
  create: jest.fn(async () => ({})),
}));

const crypto = require('crypto');
const BillingHistory = require('../../../server/models/BillingHistory');
const {
  verifyWebhookRequest,
  planIdOf,
  productIdOf,
  whopUserOf,
  toDate,
  resolvePlanFromEvent,
  processEvent,
  getProductMap,
} = require('../../../server/services/whopWebhookService');

const SECRET = 'ws_9fK2mQx7Lp4ZtR8vB3nH6cW1yJ5dG0aE';
const nowSec = () => Math.floor(Date.now() / 1000);

function sign(body, { id = 'msg_test_1', ts = nowSec(), key = Buffer.from(SECRET, 'utf8') } = {}) {
  const sig = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}` };
}

describe('verifyWebhookRequest — Whop Standard Webhooks signatures', () => {
  const body = JSON.stringify({ id: 'msg_1', type: 'payment.succeeded', data: { id: 'pay_1' } });

  it('accepts a correctly signed v1 webhook', () => {
    expect(verifyWebhookRequest(Buffer.from(body), sign(body), SECRET)).toEqual({ ok: true, scheme: 'standard' });
  });

  it('rejects a tampered body', () => {
    const headers = sign(body);
    const tampered = body.replace('pay_1', 'pay_2');
    expect(verifyWebhookRequest(tampered, headers, SECRET)).toMatchObject({ ok: false, reason: 'signature-mismatch' });
  });

  it('rejects a signature made with a different secret', () => {
    const headers = sign(body, { key: Buffer.from('ws_someone_elses_secret_value', 'utf8') });
    expect(verifyWebhookRequest(body, headers, SECRET).ok).toBe(false);
  });

  it('signs with the whole ws_ secret — a stripped prefix does not verify', () => {
    // Whop's docs: the prefix must not be stripped. Signing with the stripped
    // value must therefore fail, or we would be verifying the wrong key.
    const stripped = sign(body, { key: Buffer.from(SECRET.slice(3), 'utf8') });
    expect(verifyWebhookRequest(body, stripped, SECRET).ok).toBe(false);
  });

  it('rejects a replayed delivery outside the 5-minute window', () => {
    const old = sign(body, { ts: nowSec() - 10 * 60 });
    expect(verifyWebhookRequest(body, old, SECRET)).toMatchObject({ ok: false, reason: 'timestamp-outside-tolerance' });
  });

  it('accepts when any of several rotation signatures matches', () => {
    const good = sign(body)['webhook-signature'];
    const headers = { ...sign(body), 'webhook-signature': `v1,${Buffer.from('nope').toString('base64')} ${good}` };
    expect(verifyWebhookRequest(body, headers, SECRET).ok).toBe(true);
  });

  it('accepts a whsec_ secret the Standard Webhooks way (base64 key after the prefix)', () => {
    const raw = crypto.randomBytes(24);
    const whsec = `whsec_${raw.toString('base64')}`;
    expect(verifyWebhookRequest(body, sign(body, { key: raw }), whsec).ok).toBe(true);
  });

  it('still accepts the legacy x-whop-signature hex scheme', () => {
    const hex = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    expect(verifyWebhookRequest(body, { 'x-whop-signature': hex }, SECRET)).toEqual({ ok: true, scheme: 'legacy' });
  });

  it('rejects a request with no signature headers at all', () => {
    expect(verifyWebhookRequest(body, {}, SECRET)).toMatchObject({ ok: false, reason: 'missing-signature-headers' });
  });

  it('rejects everything when no secret is configured', () => {
    expect(verifyWebhookRequest(body, sign(body), '')).toMatchObject({ ok: false, reason: 'no-secret' });
  });
});

describe('payload accessors — nested v1 first, flat legacy as fallback', () => {
  const v1 = {
    type: 'payment.succeeded',
    data: {
      id: 'pay_1',
      plan: { id: 'plan_X' },
      product: { id: 'prod_Y', title: 'Click Pro' },
      user: { id: 'user_Z', email: 'buyer@example.com' },
    },
  };

  it('reads the nested v1 shape', () => {
    expect(planIdOf(v1)).toBe('plan_X');
    expect(productIdOf(v1)).toBe('prod_Y');
    expect(whopUserOf(v1)).toEqual({ id: 'user_Z', email: 'buyer@example.com' });
  });

  it('accepts related records given as bare id strings', () => {
    const ev = { data: { plan: 'plan_S', product: 'prod_S', user: 'user_S' } };
    expect(planIdOf(ev)).toBe('plan_S');
    expect(productIdOf(ev)).toBe('prod_S');
    expect(whopUserOf(ev).id).toBe('user_S');
  });

  it('falls back to the flat legacy fields', () => {
    const flat = { data: { plan_id: 'p1', product_id: 'q1', user_id: 'u1', email: 'e@x.com' } };
    expect(planIdOf(flat)).toBe('p1');
    expect(productIdOf(flat)).toBe('q1');
    expect(whopUserOf(flat)).toEqual({ id: 'u1', email: 'e@x.com' });
  });

  it('toDate reads Unix SECONDS as seconds, not as 1970 milliseconds', () => {
    const secs = 1_800_000_000;
    expect(toDate(secs).toISOString()).toBe(new Date(secs * 1000).toISOString());
    expect(toDate(String(secs)).getTime()).toBe(secs * 1000);
    expect(toDate('2026-10-01T00:00:00Z').toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(toDate(1_800_000_000_000).getTime()).toBe(1_800_000_000_000);
    expect(toDate(null)).toBeNull();
    expect(toDate('not a date')).toBeNull();
  });
});

describe('resolvePlanFromEvent — tier AND billing period', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { process.env = { ...OLD_ENV }; });
  afterAll(() => { process.env = OLD_ENV; });

  it('tells monthly from yearly when both plans share one product (plan id wins)', () => {
    process.env.WHOP_PRODUCT_ID_CREATOR_MONTHLY = 'plan_creatorMonth1';
    process.env.WHOP_PRODUCT_ID_CREATOR_YEARLY = 'plan_creatorYear1';
    const shared = { id: 'prod_creator' };
    expect(resolvePlanFromEvent({ data: { plan: { id: 'plan_creatorMonth1' }, product: shared } }))
      .toEqual({ planId: 'creator', period: 'monthly' });
    expect(resolvePlanFromEvent({ data: { plan: { id: 'plan_creatorYear1' }, product: shared } }))
      .toEqual({ planId: 'creator', period: 'yearly' });
  });

  it('still resolves a product-id configuration from the nested v1 shape', () => {
    process.env.WHOP_PRODUCT_ID_PRO_YEARLY = 'prod_proYearOnly';
    expect(resolvePlanFromEvent({ data: { plan: { id: 'plan_unmapped' }, product: { id: 'prod_proYearOnly' } } }))
      .toEqual({ planId: 'pro', period: 'yearly' });
  });

  it('ignores an id configured for two periods instead of silently picking one', () => {
    process.env.WHOP_PRODUCT_ID_CREATOR_MONTHLY = 'prod_samebothperiods';
    process.env.WHOP_PRODUCT_ID_CREATOR_YEARLY = 'prod_samebothperiods';
    expect(getProductMap()).not.toHaveProperty('prod_samebothperiods');
    // Falls through to the price, which CAN tell the periods apart.
    expect(resolvePlanFromEvent({ data: { product: { id: 'prod_samebothperiods' }, total: 39 } }))
      .toEqual({ planId: 'creator', period: 'monthly' });
  });

  it('reads click_plan / click_period metadata carried on the Whop plan', () => {
    const ev = { data: { plan: { id: 'plan_x', metadata: { click_plan: 'agency', click_period: 'yearly' } } } };
    expect(resolvePlanFromEvent(ev)).toEqual({ planId: 'agency', period: 'yearly' });
  });

  it('identifies the tier from a v1 product title', () => {
    expect(resolvePlanFromEvent({ data: { product: { id: 'prod_q', title: 'Click Pro (Annual)' } } }))
      .toEqual({ planId: 'pro', period: 'yearly' });
  });
});

describe('processEvent — v1 membership lifecycle', () => {
  const OLD_ENV = process.env;
  const USER_ID = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.WHOP_PRODUCT_ID_PRO_MONTHLY = 'plan_proMonthlyLive';
    process.env.WHOP_PRODUCT_ID_PRO_YEARLY = 'plan_proYearlyLive';
    BillingHistory.create.mockClear();
  });
  afterAll(() => { process.env = OLD_ENV; });

  function makeUser(subscription = {}) {
    return { _id: USER_ID, email: 'buyer@example.com', subscription, whopUserId: undefined, save: jest.fn(async function save() { return this; }) };
  }
  // Only the nested-email path can find this user — proves resolveUser reads data.user.email.
  function depsFor(user) {
    return {
      User: {
        findById: jest.fn(async () => null),
        findOne: jest.fn(async (q) => (q.email === 'buyer@example.com' ? user : null)),
      },
    };
  }

  it('membership.activated grants the plan and period, with the end date from Unix seconds', async () => {
    const user = makeUser({ status: 'trial', plan: 'free' });
    const end = nowSec() + 365 * 86400;
    const r = await processEvent({
      id: 'msg_a', type: 'membership.activated',
      data: {
        id: 'mem_1', status: 'active', renewal_period_end: end,
        plan: { id: 'plan_proYearlyLive' }, product: { id: 'prod_pro' },
        user: { id: 'user_whop_1', email: 'buyer@example.com' },
      },
    }, depsFor(user));

    expect(r).toMatchObject({ ok: true, plan: 'pro', period: 'yearly' });
    expect(user.subscription).toMatchObject({ plan: 'pro', billingCycle: 'yearly', status: 'active' });
    expect(user.subscription.endDate.getTime()).toBe(end * 1000);
    expect(user.whopUserId).toBe('user_whop_1');
  });

  it('membership.deactivated cancels, ending access at the period end', async () => {
    const user = makeUser({ status: 'active', plan: 'pro' });
    const end = nowSec() + 3 * 86400;
    const r = await processEvent({
      id: 'msg_d', type: 'membership.deactivated',
      data: { id: 'mem_1', status: 'canceled', renewal_period_end: end, user: { id: 'user_whop_1', email: 'buyer@example.com' } },
    }, depsFor(user));

    expect(r.ok).toBe(true);
    expect(user.subscription.status).toBe('cancelled');
    expect(user.subscription.endDate.getTime()).toBe(end * 1000);
  });

  it('an unrecognised paid purchase grants NO tier (it used to grant Pro)', async () => {
    const user = makeUser({ status: 'trial', plan: 'free' });
    const r = await processEvent({
      id: 'msg_u', type: 'payment.succeeded',
      data: { id: 'pay_addon', total: 12, plan: { id: 'plan_videoMinutesAddon' }, product: { id: 'prod_minutes', title: 'Video minutes' }, user: { email: 'buyer@example.com' } },
    }, depsFor(user));

    expect(r.ok).toBe(true);
    expect(user.subscription.plan).toBe('free');
    const invoice = BillingHistory.create.mock.calls[0][0];
    expect(invoice.invoice.items[0].description).not.toMatch(/pro/i);
  });

  it('returns user-not-found rather than guessing when the buyer matches no account', async () => {
    const r = await processEvent({
      type: 'membership.activated',
      data: { plan: { id: 'plan_proMonthlyLive' }, user: { id: 'user_nobody', email: 'stranger@example.com' } },
    }, depsFor(makeUser()));
    expect(r).toMatchObject({ ok: false, reason: 'user-not-found' });
  });
});

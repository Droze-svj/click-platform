/**
 * POST /api/webhooks/whop, end to end against a real database.
 *
 * Mounted exactly as server/index.js mounts it (express.raw before JSON parsing),
 * signed exactly as Whop signs (Standard Webhooks), with a v1 payload in the
 * shape Whop's OpenAPI spec defines. Before the fix this request got a 401, and
 * even a correctly verified one would have matched no user and no plan.
 */

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const User = require('../../../server/models/User');
const WebhookEvent = require('../../../server/models/WebhookEvent');

const SECRET = `ws_route_${crypto.randomBytes(16).toString('hex')}`;
const EMAIL = 'whop-route-test@example.com';
const PLAN_MONTHLY = 'plan_routeProMonthly';
const PLAN_YEARLY = 'plan_routeProYearly';

function makeApp() {
  const app = express();
  app.use('/api/webhooks/whop', express.raw({ type: 'application/json', limit: '1mb' }), require('../../../server/routes/webhooks/whop'));
  return app;
}

function signed(payload, { id = `msg_${crypto.randomBytes(6).toString('hex')}`, secret = SECRET } = {}) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(`${id}.${ts}.${body}`).digest('base64');
  return { body, headers: { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}`, 'content-type': 'application/json' } };
}

const post = (app, { body, headers }) => request(app).post('/api/webhooks/whop').set(headers).send(body);

describe('POST /api/webhooks/whop — real Whop v1 delivery', () => {
  const saved = {};
  let app;
  let user;
  const usedIds = [];

  beforeAll(async () => {
    for (const k of ['WHOP_WEBHOOK_SECRET', 'WHOP_PRODUCT_ID_PRO_MONTHLY', 'WHOP_PRODUCT_ID_PRO_YEARLY']) saved[k] = process.env[k];
    process.env.WHOP_WEBHOOK_SECRET = SECRET;
    process.env.WHOP_PRODUCT_ID_PRO_MONTHLY = PLAN_MONTHLY;
    process.env.WHOP_PRODUCT_ID_PRO_YEARLY = PLAN_YEARLY;
    app = makeApp();
    await User.deleteOne({ email: EMAIL });
    user = await User.create({ email: EMAIL, password: 'password123', name: 'Whop Route', emailVerified: true });
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await User.deleteOne({ _id: user._id });
    await WebhookEvent.deleteMany({ eventId: { $in: usedIds } });
  });

  const activation = (end) => ({
    id: 'msg_body_activation', type: 'membership.activated', api_version: 'v1', timestamp: new Date().toISOString(),
    data: {
      id: 'mem_route_1', status: 'active', renewal_period_end: end,
      plan: { id: PLAN_YEARLY }, product: { id: 'prod_routePro', title: 'Click Pro' },
      user: { id: 'user_route_whop_1', email: EMAIL },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
  });

  it('rejects an unsigned request with 401', async () => {
    const res = await request(app).post('/api/webhooks/whop').set('content-type', 'application/json').send(JSON.stringify(activation(1)));
    expect(res.status).toBe(401);
  });

  it('rejects a request signed with the wrong secret', async () => {
    const res = await post(app, signed(activation(1), { secret: 'ws_not_the_configured_secret_at_all' }));
    expect(res.status).toBe(401);
  });

  it('applies a correctly signed v1 membership.activated to the right account, plan and period', async () => {
    const end = Math.floor(Date.now() / 1000) + 365 * 86400;
    const delivery = signed(activation(end));
    usedIds.push(delivery.headers['webhook-id']);

    const res = await post(app, delivery);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, ok: true, plan: 'pro', period: 'yearly' });

    const fresh = await User.findById(user._id).lean();
    expect(fresh.subscription.plan).toBe('pro');
    expect(fresh.subscription.status).toBe('active');
    // Persisted — the schema used to drop this field silently.
    expect(fresh.subscription.billingCycle).toBe('yearly');
    expect(new Date(fresh.subscription.endDate).getTime()).toBe(end * 1000);
    expect(fresh.whopUserId).toBe('user_route_whop_1');

    // A retry of the same delivery (same webhook-id) is a no-op.
    const replay = await post(app, delivery);
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);
  });

  it('a signed membership.deactivated cancels the account', async () => {
    const delivery = signed({
      id: 'msg_body_deactivation', type: 'membership.deactivated', api_version: 'v1', timestamp: new Date().toISOString(),
      data: { id: 'mem_route_1', status: 'canceled', user: { id: 'user_route_whop_1', email: EMAIL }, updated_at: new Date(Date.now() + 1000).toISOString() },
    });
    usedIds.push(delivery.headers['webhook-id']);

    const res = await post(app, delivery);
    expect(res.status).toBe(200);
    const fresh = await User.findById(user._id).lean();
    expect(fresh.subscription.status).toBe('cancelled');
  });
});

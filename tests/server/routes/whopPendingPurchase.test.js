/**
 * A Whop purchase made before the buyer has a Click account (or with an email
 * that has none) used to be dropped as "user-not-found" — the plan was never
 * granted. It's now held and applied when that account registers or signs in.
 *
 * The connection + isolated in-memory DB are owned by tests/setup.js.
 */

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const User = require('../../../server/models/User');
const PendingWhopEvent = require('../../../server/models/PendingWhopEvent');
const { claimPendingEvents } = require('../../../server/services/whopWebhookService');

const SECRET = `ws_pending_${crypto.randomBytes(16).toString('hex')}`;
const PLAN = 'plan_pendingProMonthly';
const EMAIL = `buyer-${Date.now()}@example.com`;

function signed(payload, id = `msg_${crypto.randomBytes(6).toString('hex')}`) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(`${id}.${ts}.${body}`).digest('base64');
  return { body, headers: { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}`, 'content-type': 'application/json' } };
}

describe('Whop purchase before the account exists', () => {
  const saved = {};
  let app;

  beforeAll(() => {
    for (const k of ['WHOP_WEBHOOK_SECRET', 'WHOP_PRODUCT_ID_PRO_MONTHLY']) saved[k] = process.env[k];
    process.env.WHOP_WEBHOOK_SECRET = SECRET;
    process.env.WHOP_PRODUCT_ID_PRO_MONTHLY = PLAN;
    app = express();
    app.use('/api/webhooks/whop', express.raw({ type: 'application/json' }), require('../../../server/routes/webhooks/whop'));
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });

  it('holds the payment, then grants the plan when the buyer signs up', async () => {
    const payload = {
      type: 'membership.activated', api_version: 'v1', timestamp: new Date().toISOString(),
      data: {
        id: 'mem_pending_1', status: 'active', renewal_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        plan: { id: PLAN }, product: { id: 'prod_pendingPro' }, user: { id: 'user_pending_1', email: EMAIL },
      },
    };
    const msg = signed(payload);
    const res = await request(app).post('/api/webhooks/whop').set(msg.headers).send(msg.body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reason: 'user-not-found', held: true });
    expect(await PendingWhopEvent.countDocuments({ email: EMAIL, claimedAt: null })).toBe(1);

    const user = await User.create({ email: EMAIL, password: 'password123', name: 'Buyer', emailVerified: true });
    const out = await claimPendingEvents(user);
    expect(out.claimed).toBe(1);

    const after = await User.findById(user._id).lean();
    expect(after.subscription.status).toBe('active');
    expect(after.subscription.plan).toBe('pro');
    expect(after.subscription.whopSubscriptionId).toBe('mem_pending_1');
    expect(await PendingWhopEvent.countDocuments({ email: EMAIL, claimedAt: null })).toBe(0);

    // Claiming again is a no-op.
    expect((await claimPendingEvents(user)).claimed).toBe(0);
  });
});

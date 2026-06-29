// Two-phase webhook idempotency: a claim that fails before apply must be
// re-processable on retry (so a paid entitlement is never permanently dropped),
// while a fully-processed event becomes a safe no-op. (tests/setup.js owns the
// in-memory Mongo connection.)
const WebhookEvent = require('../../../server/models/WebhookEvent');
const { claimEvent, markProcessed } = require('../../../server/routes/webhooks/whop');

describe('whop webhook two-phase idempotency', () => {
  beforeEach(async () => { await WebhookEvent.deleteMany({}); });

  it('first claim succeeds', async () => {
    const r = await claimEvent('whop', 'evt-1', 'subscription.created');
    expect(r.claimed).toBe(true);
    expect(r.duplicate).toBeUndefined();
  });

  it('retry of an UNPROCESSED event is allowed to re-process (no dropped entitlement)', async () => {
    await claimEvent('whop', 'evt-2', 'subscription.created'); // claimed, processing then "crashes"
    const retry = await claimEvent('whop', 'evt-2', 'subscription.created');
    expect(retry.claimed).toBe(true);
    expect(retry.retryUnprocessed).toBe(true);
  });

  it('once processed, a duplicate is skipped', async () => {
    await claimEvent('whop', 'evt-3', 'subscription.created');
    await markProcessed('whop', 'evt-3', { ok: true });
    const dup = await claimEvent('whop', 'evt-3', 'subscription.created');
    expect(dup.claimed).toBe(false);
    expect(dup.duplicate).toBe(true);
  });

  it('markProcessed flips the flag', async () => {
    await claimEvent('whop', 'evt-4', 'x');
    expect((await WebhookEvent.findOne({ eventId: 'evt-4' }).lean()).processed).toBe(false);
    await markProcessed('whop', 'evt-4', { ok: true });
    expect((await WebhookEvent.findOne({ eventId: 'evt-4' }).lean()).processed).toBe(true);
  });
});

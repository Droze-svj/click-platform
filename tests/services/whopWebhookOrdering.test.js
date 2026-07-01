// Whop webhook ordering guard (WHOP_WEBHOOK_ORDERING_GUARD).
//
// Idempotency stops a *processed* event re-applying, but not an out-of-order or
// replayed *older* event. The classic failure: a delayed `payment.succeeded`
// arriving AFTER a `cancelled` re-grants the tier. The guard drops events
// provably older than the last one applied — but only when both timestamps are
// known, so it can never drop a first/only event or a timestamp-less provider's.

const { getEventTime, processEvent } = require('../../server/services/whopWebhookService');

const OID = '507f1f77bcf86cd799439011';

function makeUser(subscription = {}) {
  return {
    _id: OID,
    subscription,
    whopUserId: undefined,
    save: jest.fn(async function save() { return this; }),
  };
}

// deps.User whose resolveUser() path (passthrough → findById) returns our user.
function depsFor(user) {
  return { User: { findById: jest.fn(async () => user), findOne: jest.fn(async () => null) } };
}

function evt(action, data = {}) {
  return { action, data: { passthrough: OID, ...data } };
}

describe('getEventTime', () => {
  it('parses ISO strings', () => {
    expect(getEventTime({ data: { created_at: '2026-01-01T00:00:00.000Z' } }))
      .toBe(Date.parse('2026-01-01T00:00:00.000Z'));
  });
  it('parses epoch seconds and epoch millis', () => {
    expect(getEventTime({ data: { created_at: 1_700_000_000 } })).toBe(1_700_000_000_000);
    expect(getEventTime({ data: { created_at: 1_700_000_000_000 } })).toBe(1_700_000_000_000);
  });
  it('prefers updated_at over created_at', () => {
    const t = getEventTime({ data: { updated_at: '2026-02-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' } });
    expect(t).toBe(Date.parse('2026-02-01T00:00:00Z'));
  });
  it('returns null when no timestamp is present or parseable', () => {
    expect(getEventTime({ data: {} })).toBeNull();
    expect(getEventTime({ data: { created_at: 'not-a-date' } })).toBeNull();
  });
});

describe('processEvent ordering guard', () => {
  const OLD_ENV = process.env.WHOP_WEBHOOK_ORDERING_GUARD;
  afterEach(() => { process.env.WHOP_WEBHOOK_ORDERING_GUARD = OLD_ENV; });

  it('flag OFF: an older event still applies (no behaviour change)', async () => {
    delete process.env.WHOP_WEBHOOK_ORDERING_GUARD;
    const user = makeUser({ status: 'cancelled', lastEventAt: new Date('2026-02-01T00:00:00Z') });
    const r = await processEvent(evt('payment.succeeded', { created_at: '2026-01-01T00:00:00Z' }), depsFor(user));
    expect(r.stale).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
    expect(user.subscription.status).toBe('active');
  });

  it('flag ON: drops an older payment.succeeded after a newer cancellation (the bug)', async () => {
    process.env.WHOP_WEBHOOK_ORDERING_GUARD = 'true';
    const user = makeUser({ status: 'cancelled', lastEventAt: new Date('2026-02-01T00:00:00Z') });
    const r = await processEvent(evt('payment.succeeded', { created_at: '2026-01-01T00:00:00Z' }), depsFor(user));
    expect(r.stale).toBe(true);
    expect(user.save).not.toHaveBeenCalled();
    expect(user.subscription.status).toBe('cancelled'); // NOT re-activated
  });

  it('flag ON: a newer event applies and advances lastEventAt', async () => {
    process.env.WHOP_WEBHOOK_ORDERING_GUARD = 'true';
    const user = makeUser({ status: 'cancelled', lastEventAt: new Date('2026-01-01T00:00:00Z') });
    const r = await processEvent(evt('payment.succeeded', { created_at: '2026-03-01T00:00:00Z' }), depsFor(user));
    expect(r.stale).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
    expect(user.subscription.status).toBe('active');
    expect(new Date(user.subscription.lastEventAt).toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('flag ON: first event (no prior lastEventAt) always applies + stamps', async () => {
    process.env.WHOP_WEBHOOK_ORDERING_GUARD = 'true';
    const user = makeUser({});
    const r = await processEvent(evt('payment.succeeded', { created_at: '2026-01-01T00:00:00Z' }), depsFor(user));
    expect(r.stale).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
    expect(user.subscription.lastEventAt).toBeInstanceOf(Date);
  });

  it('flag ON: a timestamp-less event still applies (never dropped)', async () => {
    process.env.WHOP_WEBHOOK_ORDERING_GUARD = 'true';
    const user = makeUser({ status: 'cancelled', lastEventAt: new Date('2026-02-01T00:00:00Z') });
    const r = await processEvent(evt('payment.succeeded', {}), depsFor(user)); // no created_at
    expect(r.stale).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
  });
});

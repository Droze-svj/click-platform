// "You're slipping" alert (B4) + hardening. Locks in: fires on a synthetic >20%
// engagement drop vs the creator's OWN baseline; stays silent when stable, thin, or
// weak; respects the per-user cooldown; the alert carries the REAL measured drop; and
// — critically — never blends a raw count with a rate (which fired FALSE alerts).

jest.mock('../../server/models/ScheduledPost', () => ({ find: jest.fn(), distinct: jest.fn() }));
jest.mock('../../server/models/Notification', () => ({ findOne: jest.fn() }));
jest.mock('../../server/services/notificationService', () => ({ createNotification: jest.fn() }));

const ScheduledPost = require('../../server/models/ScheduledPost');
const Notification = require('../../server/models/Notification');
const notificationService = require('../../server/services/notificationService');
const svc = require('../../server/services/performanceAlertService');

const NOW = 1_700_000_000_000; // fixed "now" so windowing is deterministic
const DAY = 86400000;

// A posted post `agoDays` before NOW. reach=0 → no comparable rate (excluded).
function post(agoDays, engagement, reach = 100, platform = 'tiktok') {
  return { platform, postedAt: new Date(NOW - agoDays * DAY), analytics: { engagement, reach } };
}
function mockFind(posts) {
  ScheduledPost.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(posts) }) });
}
const rep = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

describe('performanceAlertService', () => {
  beforeEach(() => {
    ScheduledPost.find.mockReset();
    ScheduledPost.distinct.mockReset();
    Notification.findOne.mockReset();
    notificationService.createNotification.mockReset();
    Notification.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) }); // no prior alert
  });

  it('evaluateSlip flags a real >20% drop vs baseline', () => {
    const posts = [
      ...rep(6, (i) => post(20 + i, 50)), // baseline ~50% rate
      ...rep(6, (i) => post(1 + i, 20)),  // recent ~20% rate → 60% drop
    ];
    const r = svc.evaluateSlip(posts, NOW);
    expect(r.slipping).toBe(true);
    expect(r.dropPct).toBeGreaterThan(0.2);
    expect(r.recentRate).toBeCloseTo(0.2, 5);
    expect(r.baselineRate).toBeCloseTo(0.5, 5);
  });

  it('stays silent when engagement is stable', () => {
    const posts = [...rep(6, (i) => post(20 + i, 50)), ...rep(6, (i) => post(1 + i, 49))];
    expect(svc.evaluateSlip(posts, NOW).slipping).toBe(false);
  });

  it('stays silent (honest) when the sample is too thin', () => {
    const posts = [post(20, 50), post(1, 5)]; // < MIN_SAMPLE in both windows
    const r = svc.evaluateSlip(posts, NOW);
    expect(r.slipping).toBe(false);
    expect(r.reason).toBe('insufficient-data');
  });

  it('does NOT fire a false alert when baseline posts lack a denominator (count vs rate mix)', () => {
    // The classic false-alert: baseline posts synced before reach populated (raw
    // counts ~100), recent posts now carry reach (a healthy 10% rate). Blending the
    // two units used to read as a ~99% "drop". Now the count-only baseline posts are
    // EXCLUDED → not enough comparable baseline → honest silence, not a false alarm.
    const posts = [
      ...rep(6, (i) => post(20 + i, 100, 0)),  // baseline: NO reach → excluded
      ...rep(6, (i) => post(1 + i, 10, 100)),  // recent: 10% rate
    ];
    const r = svc.evaluateSlip(posts, NOW);
    expect(r.slipping).toBe(false);
    expect(r.reason).toBe('insufficient-data');
  });

  it('stays silent when the baseline rate is too weak to measure a drop off of', () => {
    const posts = [
      ...rep(6, (i) => post(20 + i, 1, 1_000_000)), // baseline ~1e-6 rate
      ...rep(6, (i) => post(1 + i, 5, 100)),
    ];
    const r = svc.evaluateSlip(posts, NOW);
    expect(r.slipping).toBe(false);
    expect(r.reason).toBe('baseline-too-weak');
  });

  it('evaluateAndAlert raises ONE notification carrying the REAL measured drop', async () => {
    mockFind([...rep(6, (i) => post(20 + i, 50)), ...rep(6, (i) => post(1 + i, 20))]);
    const r = await svc.evaluateAndAlert('6a3500000000000000000aaa', { now: NOW });
    expect(r.alerted).toBe(true);
    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    const args = notificationService.createNotification.mock.calls[0];
    expect(args[3]).toBe('warning');                              // type
    expect(args[5].context.entityType).toBe('performance-slip');  // dedupe marker
    expect(args[5].data.dropPct).toBeCloseTo(0.6, 5);            // real number, not invented
  });

  it('respects the cooldown — no second alert when one is already recent', async () => {
    mockFind([...rep(6, (i) => post(20 + i, 50)), ...rep(6, (i) => post(1 + i, 20))]);
    Notification.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 'x' }) }) });
    const r = await svc.evaluateAndAlert('6a3500000000000000000bbb', { now: NOW });
    expect(r.alerted).toBe(false);
    expect(r.reason).toBe('cooldown');
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});

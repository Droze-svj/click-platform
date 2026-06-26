// "You're slipping" alert (B4). Locks in: fires on a synthetic >20% engagement
// drop vs the creator's OWN baseline, stays silent when stable, stays silent when
// the sample is too thin (honesty), respects the per-user cooldown, and the numbers
// in the alert are the REAL measured drop (never fabricated).

jest.mock('../../server/models/ScheduledPost', () => ({ find: jest.fn(), distinct: jest.fn() }));
jest.mock('../../server/models/Notification', () => ({ findOne: jest.fn() }));
jest.mock('../../server/services/notificationService', () => ({ createNotification: jest.fn() }));

const ScheduledPost = require('../../server/models/ScheduledPost');
const Notification = require('../../server/models/Notification');
const notificationService = require('../../server/services/notificationService');
const svc = require('../../server/services/performanceAlertService');

const NOW = 1_700_000_000_000; // fixed "now" so windowing is deterministic
const DAY = 86400000;

// Build a posted post `agoDays` before NOW with a given engagement rate via reach.
function post(agoDays, engagement, reach = 100, platform = 'tiktok') {
  return { platform, postedAt: new Date(NOW - agoDays * DAY), analytics: { engagement, reach } };
}
function mockFind(posts) {
  ScheduledPost.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(posts) }) });
}

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
      // baseline (8–60d ago): ~50% engagement
      ...Array.from({ length: 5 }, (_, i) => post(20 + i, 50)),
      // recent (≤7d): ~20% engagement → 60% drop
      ...Array.from({ length: 4 }, (_, i) => post(1 + i, 20)),
    ];
    const r = svc.evaluateSlip(posts, NOW);
    expect(r.slipping).toBe(true);
    expect(r.dropPct).toBeGreaterThan(0.2);
    expect(r.recentRate).toBeCloseTo(0.2, 5);
    expect(r.baselineRate).toBeCloseTo(0.5, 5);
  });

  it('stays silent when engagement is stable', () => {
    const posts = [
      ...Array.from({ length: 5 }, (_, i) => post(20 + i, 50)),
      ...Array.from({ length: 4 }, (_, i) => post(1 + i, 49)),
    ];
    expect(svc.evaluateSlip(posts, NOW).slipping).toBe(false);
  });

  it('stays silent (honest) when the sample is too thin', () => {
    const posts = [post(20, 50), post(1, 5)]; // 1 baseline + 1 recent < MIN_SAMPLE
    const r = svc.evaluateSlip(posts, NOW);
    expect(r.slipping).toBe(false);
    expect(r.reason).toBe('insufficient-data');
  });

  it('evaluateAndAlert raises ONE notification carrying the REAL measured drop', async () => {
    mockFind([
      ...Array.from({ length: 5 }, (_, i) => post(20 + i, 50)),
      ...Array.from({ length: 4 }, (_, i) => post(1 + i, 20)),
    ]);
    const r = await svc.evaluateAndAlert('6a3500000000000000000aaa', { now: NOW });
    expect(r.alerted).toBe(true);
    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    const args = notificationService.createNotification.mock.calls[0];
    expect(args[3]).toBe('warning');                 // type
    expect(args[5].context.entityType).toBe('performance-slip'); // dedupe marker
    expect(args[5].data.dropPct).toBeCloseTo(0.6, 5); // real number, not invented
  });

  it('respects the cooldown — no second alert when one is already recent', async () => {
    mockFind([
      ...Array.from({ length: 5 }, (_, i) => post(20 + i, 50)),
      ...Array.from({ length: 4 }, (_, i) => post(1 + i, 20)),
    ]);
    Notification.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 'x' }) }) });
    const r = await svc.evaluateAndAlert('6a3500000000000000000bbb', { now: NOW });
    expect(r.alerted).toBe(false);
    expect(r.reason).toBe('cooldown');
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});

// The subscription cron scans switched from an unbounded User.find() to _id-cursor
// pagination. This proves the cursor advances across MULTIPLE batches (batch=2,
// 3 users) so no user is skipped — the whole point of the change.

// notifyUser hits the realtime/socket path (irrelevant here and can hang without
// a booted socket server) — stub it so the test targets only the cursor scan.
jest.mock('../../server/services/notificationService', () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

const User = require('../../server/models/User');
const MembershipPackage = require('../../server/models/MembershipPackage');
// Required normally (NOT via isolateModules) so it shares the test's connected
// mongoose; the batch size is read at call-time from env, so no isolation needed.
const svc = require('../../server/services/subscriptionService');

describe('subscription cron scan pagination', () => {
  const ids = [];

  beforeAll(async () => {
    // Force a tiny batch so 3 matching users span 2 pages.
    process.env.CRON_SCAN_BATCH = '2';
    // A default (free) package for the downgrade path.
    await MembershipPackage.create({ name: 'Free', slug: 'free-test', isDefault: true, price: 0 });

    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (let i = 0; i < 3; i++) {
      const u = await User.create({
        email: `expire-${i}@example.com`,
        password: 'password123',
        name: `Expire ${i}`,
        emailVerified: true,
        subscription: { status: 'active', endDate: past },
      });
      ids.push(u._id);
    }
  });

  afterAll(async () => {
    await User.deleteMany({ _id: { $in: ids } });
    await MembershipPackage.deleteMany({ name: 'Free' });
    delete process.env.CRON_SCAN_BATCH;
  });

  it('processExpiredSubscriptions expires ALL matching users across batches', async () => {
    await svc.processExpiredSubscriptions();
    const rows = await User.find({ _id: { $in: ids } }).select('subscription.status').lean();
    expect(rows).toHaveLength(3);
    // Every seeded user must have been visited and flipped to 'expired' — proves
    // the second page (users 3) wasn't dropped by a single-batch scan.
    for (const r of rows) {
      expect(r.subscription.status).toBe('expired');
    }
  });
});

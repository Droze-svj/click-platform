// Covers the two usageTrackingService functions that billing.js imported + called
// but were never defined — every GET /api/billing/usage/check and /overage hit a
// `canPerformAction is not a function` 500. These lock the contract.

const mongoose = require('mongoose');
const connectTestDb = require('../helpers/connectTestDb');
const { canPerformAction, calculateOverageCharges } = require('../../server/services/usageTrackingService');
const UsageTracking = require('../../server/models/UsageTracking');

const now = new Date();
const PERIOD = { year: now.getFullYear(), month: now.getMonth() + 1 };

beforeAll(async () => { await connectTestDb(); });
afterEach(async () => { await UsageTracking.deleteMany({}); });

describe('usageTrackingService.canPerformAction', () => {
  it('is a function (regression: was imported but undefined → 500)', () => {
    expect(typeof canPerformAction).toBe('function');
    expect(typeof calculateOverageCharges).toBe('function');
  });

  it('allows when no tracking row exists (default limits = unlimited)', async () => {
    const res = await canPerformAction(new mongoose.Types.ObjectId(), 'videosProcessed', 1);
    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(-1);
  });

  it('blocks when usage + amount would exceed a real limit', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UsageTracking.create({
      userId, period: PERIOD,
      usage: { videosProcessed: 5 },
      limits: { videosProcessed: 5 },
    });
    const res = await canPerformAction(userId, 'videosProcessed', 1);
    expect(res.allowed).toBe(false);
    expect(res.used).toBe(5);
    expect(res.limit).toBe(5);
    expect(res.upgradeRequired).toBe(true);
  });

  it('allows when still under the limit', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UsageTracking.create({
      userId, period: PERIOD,
      usage: { videosProcessed: 2 },
      limits: { videosProcessed: 5 },
    });
    const res = await canPerformAction(userId, 'videosProcessed', 2);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(3);
  });

  it('treats an unknown/unlimited type as allowed (never falsely blocks)', async () => {
    const res = await canPerformAction(new mongoose.Types.ObjectId(), 'somethingNew', 100);
    expect(res.allowed).toBe(true);
  });
});

describe('usageTrackingService.calculateOverageCharges', () => {
  it('returns zeros (no throw) for a non-ObjectId / unknown user', async () => {
    const res = await calculateOverageCharges('not-an-objectid-uuid');
    expect(res.total).toBe(0);
    expect(res.overageCharges).toEqual({});
  });

  it('sums the stored overageCharges for the current period', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UsageTracking.create({
      userId, period: PERIOD,
      overage: { videosProcessed: 3, contentGenerated: 1 },
      overageCharges: { videosProcessed: 6, contentGenerated: 2 },
    });
    const res = await calculateOverageCharges(userId);
    expect(res.total).toBe(8);
    expect(res.overage.videosProcessed).toBe(3);
  });
});

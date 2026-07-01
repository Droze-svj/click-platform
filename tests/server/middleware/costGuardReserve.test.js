// costGuard atomic reserve-then-settle (closes the assertBudget TOCTOU).
//
// The bug: assertBudget reads remaining budget, decides allow, then records
// usage later — so two concurrent AI calls both read the same remaining, both
// pass, and both spend, overshooting the ceiling by up to one call. reserveBudget
// debits the estimate up-front with a single conditional $inc, so N racing calls
// can never collectively exceed budget. settle corrects to real usage; release
// refunds an unsettled reservation.

const connectTestDb = require('../../helpers/connectTestDb');
const User = require('../../../server/models/User');
const UsageMeter = require('../../../server/models/UsageMeter');
const {
  reserveBudget,
  settleReservation,
  releaseReservation,
  resolveTierBudgetUsd,
  estimateCostUsd,
} = require('../../../server/middleware/costGuard');

const monthKey = () => new Date().toISOString().slice(0, 7);
const meterFor = (userId) => UsageMeter.findOne({ userId, monthKey: monthKey() }).lean();
// gemini output rate is $0.3 / 1M tokens; size expectedOutputTokens to hit a $target.
const outTokensFor = (usd) => Math.round((usd / 0.3) * 1_000_000);
const call = (userId, targetUsd) => ({
  userId, provider: 'gemini', model: 'gemini-2.5-flash', prompt: 'x',
  expectedOutputTokens: outTokensFor(targetUsd),
});

let userId;
let budget;

beforeAll(async () => {
  await connectTestDb();
  const u = await User.create({ email: 'reserve-test@example.com', password: 'password123', name: 'Reserve Test' });
  userId = u._id.toString();
  budget = await resolveTierBudgetUsd(userId);
});
afterEach(async () => { await UsageMeter.deleteMany({}); });

describe('costGuard reserveBudget / settle / release', () => {
  it('resolves a finite tier budget for the test user', () => {
    expect(Number.isFinite(budget)).toBe(true);
    expect(budget).toBeGreaterThan(0);
  });

  it('reserves within budget and debits the meter by the estimate', async () => {
    const target = budget * 0.4;
    const r = await reserveBudget(call(userId, target));
    expect(r.reservedUsd).toBeGreaterThan(0);
    const meter = await meterFor(userId);
    expect(meter.aiSpendUsd).toBeCloseTo(r.reservedUsd, 6);
  });

  it('rejects (402) a reservation that would exceed budget', async () => {
    await expect(reserveBudget(call(userId, budget * 1.5))).rejects.toMatchObject({ statusCode: 402 });
    const meter = await meterFor(userId);
    // Refused reservation must not have debited anything.
    expect(meter?.aiSpendUsd || 0).toBe(0);
  });

  it('CONCURRENCY: two racing 0.6×budget reserves — exactly one wins, meter stays within budget', async () => {
    const results = await Promise.allSettled([
      reserveBudget(call(userId, budget * 0.6)),
      reserveBudget(call(userId, budget * 0.6)),
    ]);
    const won = results.filter(r => r.status === 'fulfilled');
    const lost = results.filter(r => r.status === 'rejected');
    expect(won.length).toBe(1);
    expect(lost.length).toBe(1);
    expect(lost[0].reason.statusCode).toBe(402);
    const meter = await meterFor(userId);
    expect(meter.aiSpendUsd).toBeLessThanOrEqual(budget + 1e-9); // never overshoots
    expect(meter.aiSpendUsd).toBeCloseTo(won[0].value.reservedUsd, 6);
  });

  it('settle corrects the meter from the estimate to the real usage', async () => {
    const r = await reserveBudget(call(userId, budget * 0.5));
    // Actual usage tiny vs the estimate — settle should bring the meter down.
    await settleReservation({
      userId, provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: 10, outputTokens: 10, reservedUsd: r.reservedUsd,
    });
    const actual = estimateCostUsd({ provider: 'gemini', model: 'gemini-2.5-flash', prompt: '', expectedOutputTokens: 10 });
    // input(10) + output(10) cost — recompute the way settle does:
    const rate = { input: 0.075, output: 0.3 };
    const actualUsd = (10 / 1e6) * rate.input + (10 / 1e6) * rate.output;
    const meter = await meterFor(userId);
    expect(meter.aiSpendUsd).toBeCloseTo(actualUsd, 9);
    expect(meter.callCount).toBe(1);
    void actual;
  });

  it('release refunds an unsettled reservation back to zero', async () => {
    const r = await reserveBudget(call(userId, budget * 0.5));
    let meter = await meterFor(userId);
    expect(meter.aiSpendUsd).toBeCloseTo(r.reservedUsd, 6);
    await releaseReservation({ userId, reservedUsd: r.reservedUsd });
    meter = await meterFor(userId);
    expect(meter.aiSpendUsd).toBeCloseTo(0, 6);
  });
});

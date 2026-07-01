const connectTestDb = require('../helpers/connectTestDb');
const PromoCode = require('../../server/models/PromoCode');
const { claimPromoCode } = require('../../server/services/billingService');

beforeAll(async () => { await connectTestDb(); });
afterEach(async () => { await PromoCode.deleteMany({}); });

const seed = (over = {}) => PromoCode.create({
  code: 'SAVE10', discountType: 'percentage', discountValue: 10,
  maxUses: 1, usedCount: 0, isActive: true, ...over,
});

describe('billingService.claimPromoCode (atomic single-use)', () => {
  it('is exported (regression: usedCount was never incremented)', () => {
    expect(typeof claimPromoCode).toBe('function');
  });

  it('claims one use and increments usedCount', async () => {
    await seed();
    const c = await claimPromoCode('SAVE10');
    expect(c).toBeTruthy();
    expect(c.usedCount).toBe(1);
  });

  it('refuses a second claim once a single-use code is exhausted', async () => {
    await seed({ maxUses: 1 });
    expect(await claimPromoCode('SAVE10')).toBeTruthy();
    expect(await claimPromoCode('SAVE10')).toBeNull(); // exhausted
  });

  it('is case-insensitive on the code', async () => {
    await seed();
    expect(await claimPromoCode('save10')).toBeTruthy();
  });

  it('unlimited code (maxUses -1) always claims', async () => {
    await seed({ maxUses: -1 });
    for (let i = 0; i < 5; i++) expect(await claimPromoCode('SAVE10')).toBeTruthy();
  });

  it('returns null for unknown / inactive codes', async () => {
    await seed({ isActive: false });
    expect(await claimPromoCode('SAVE10')).toBeNull();
    expect(await claimPromoCode('NOPE')).toBeNull();
  });

  it('under concurrency, a single-use code is claimed exactly once', async () => {
    await seed({ maxUses: 1 });
    const results = await Promise.all([1, 2, 3, 4].map(() => claimPromoCode('SAVE10')));
    expect(results.filter(Boolean).length).toBe(1); // race-safe
  });
});

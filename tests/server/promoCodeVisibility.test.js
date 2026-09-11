// GET /api/billing/promo-codes is unauthenticated and used to return EVERY
// active promo code with uses remaining.
//
// referralService mints per-user rewards — REF-REWARD-<id> and REF-NEW-<id>,
// maxUses: 1, isActive: true, valid for 30-90 days — so every one of them was
// published the moment it was created, and the first stranger to read the list
// could redeem another user's reward. Nothing on the model distinguished a
// broadcast promo from a targeted one.
//
// PromoCode.isPublic now records that, and defaults to FALSE: a code has to be
// explicitly marked as advertised to be listed. Fail-closed, so codes minted by
// any future path are private unless someone opts them in.

const request = require('supertest');
const app = require('../../server/index');
const PromoCode = require('../../server/models/PromoCode');

const base = {
  discountType: 'percentage',
  discountValue: 20,
  validFrom: new Date(Date.now() - 1000),
  validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  isActive: true,
  maxUses: -1,
  usedCount: 0,
};

describe('public promo-code listing', () => {
  afterEach(async () => {
    await PromoCode.deleteMany({ code: { $in: ['PUBLIC-SALE', 'REF-REWARD-abc12345'] } });
  });

  it('does not leak a per-user referral reward', async () => {
    // Exactly what referralService.create mints.
    await PromoCode.create({
      ...base,
      code: 'REF-REWARD-abc12345',
      description: 'Referral reward - 1 month free',
      discountType: 'free_months',
      discountValue: 1,
      maxUses: 1,
      maxUsesPerUser: 1,
    });

    const res = await request(app).get('/api/billing/promo-codes');
    expect(res.status).toBe(200);

    const codes = (res.body?.data?.promoCodes || []).map((p) => p.code);
    expect(codes).not.toContain('REF-REWARD-abc12345');
  });

  it('still lists a code that is explicitly advertised', async () => {
    await PromoCode.create({ ...base, code: 'PUBLIC-SALE', description: 'Launch sale', isPublic: true });

    const res = await request(app).get('/api/billing/promo-codes');
    const codes = (res.body?.data?.promoCodes || []).map((p) => p.code);
    expect(codes).toContain('PUBLIC-SALE');
  });

  it('defaults to private, so a code created without the flag is not listed', async () => {
    const created = await PromoCode.create({ ...base, code: 'PUBLIC-SALE', description: 'Unflagged' });
    expect(created.isPublic).toBe(false);

    const res = await request(app).get('/api/billing/promo-codes');
    const codes = (res.body?.data?.promoCodes || []).map((p) => p.code);
    expect(codes).not.toContain('PUBLIC-SALE');
  });
});

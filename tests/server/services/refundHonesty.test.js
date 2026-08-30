// A refund may only be reported as 'processed' when money actually moved.
//
// processPaymentRefund() used to return a fabricated
// `REF-<timestamp>-<random>` id which the caller stored while setting
// refund.status = 'processed' — telling the customer they had been refunded
// when nothing was ever charged back. (It also assigned the status
// 'processing', which wasn't in the schema enum, so every attempt actually
// threw a ValidationError on save.)

const mongoose = require('mongoose');

jest.mock('../../../server/services/whopMonetizationService', () => ({
  fetchWhopProducts: jest.fn(async () => []),
  refundWhopPayment: jest.fn(),
}));

const whop = require('../../../server/services/whopMonetizationService');
const CancellationRequest = require('../../../server/models/CancellationRequest');
const { processRefund } = require('../../../server/services/selfServeCancellationService');

const userId = new mongoose.Types.ObjectId();

async function seedCancellation() {
  return CancellationRequest.create({
    userId,
    subscriptionId: 'whop_receipt_123',
    cancellation: { requestedAt: new Date(), effectiveDate: new Date(), reason: 'too_expensive', method: 'self_serve' },
    refund: { requested: true, amount: 25, currency: 'USD', status: 'approved' },
    status: 'pending',
  });
}

describe('refund honesty', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(async () => { await CancellationRequest.deleteMany({ userId }); });

  it('records the provider transaction id on a real success', async () => {
    whop.refundWhopPayment.mockResolvedValue({
      success: true, transactionId: 'whop_refund_abc', reason: null, configured: true,
    });

    const c = await seedCancellation();
    const updated = await processRefund(c._id, { amount: 25 });

    expect(whop.refundWhopPayment).toHaveBeenCalledWith('whop_receipt_123', { amount: 25 });
    expect(updated.refund.status).toBe('processed');
    expect(updated.refund.transactionId).toBe('whop_refund_abc');
    expect(updated.refund.processedAt).toBeTruthy();
    expect(updated.status).toBe('completed');
  });

  it("does NOT report 'processed' when the provider rejects the refund", async () => {
    whop.refundWhopPayment.mockResolvedValue({
      success: false, transactionId: null, reason: 'Receipt already refunded', configured: true,
    });

    const c = await seedCancellation();
    const updated = await processRefund(c._id, { amount: 25 });

    expect(updated.refund.status).toBe('failed');
    expect(updated.refund.transactionId).toBeUndefined();
    expect(updated.refund.failureReason).toBe('Receipt already refunded');
    // The cancellation stays open so it lands in the operator queue.
    expect(updated.status).not.toBe('completed');
  });

  it('leaves the refund actionable when no provider is configured', async () => {
    whop.refundWhopPayment.mockResolvedValue({
      success: false, transactionId: null, configured: false,
      reason: 'WHOP_API_KEY is not configured — refunds must be issued manually in the Whop dashboard.',
    });

    const c = await seedCancellation();
    const updated = await processRefund(c._id, { amount: 25 });

    expect(updated.refund.status).toBe('failed');
    expect(updated.refund.failureReason).toMatch(/WHOP_API_KEY/);
    expect(updated.refund.transactionId).toBeUndefined();
  });

  it('never synthesizes a transaction id', async () => {
    whop.refundWhopPayment.mockResolvedValue({
      success: false, transactionId: null, reason: 'network down', configured: true,
    });

    const c = await seedCancellation();
    const updated = await processRefund(c._id, { amount: 25 });

    // The old fabricated form was `REF-<timestamp>-<random>`.
    expect(String(updated.refund.transactionId || '')).not.toMatch(/^REF-\d+/);
  });

  it("supports the 'processing' and 'failed' states the code assigns", () => {
    const enumValues = CancellationRequest.schema.path('refund.status').enumValues;
    expect(enumValues).toEqual(expect.arrayContaining(['processing', 'failed', 'processed']));
  });
});

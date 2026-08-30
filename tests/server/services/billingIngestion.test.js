// Nothing in this codebase ever created a BillingHistory document, so
// billingHistoryService and every endpoint behind it read an always-empty
// collection: the subscription state was persisted on the User, the money never
// was. The Whop webhook now records the invoice, and the PDF endpoints render a
// real file instead of returning {url: null} / "PDF generation not implemented".

const mongoose = require('mongoose');
const BillingHistory = require('../../../server/models/BillingHistory');
const { downloadInvoicePDF } = require('../../../server/services/billingHistoryService');
const { generateComplianceReport } = require('../../../server/services/musicComplianceReportService');

const userId = new mongoose.Types.ObjectId();

const PDF_MAGIC = '%PDF-';

describe('billing history ingestion', () => {
  afterEach(async () => { await BillingHistory.deleteMany({ userId }); });

  it('records a paid invoice from a Whop payment event', async () => {
    const { processEvent } = require('../../../server/services/whopWebhookService');
    const User = require('../../../server/models/User');

    const user = await User.create({
      email: 'billing-ingest@example.com', password: 'password123', name: 'Billing', emailVerified: true,
      whopUserId: 'whop_user_1',
    });

    process.env.WHOP_PRODUCT_ID_CREATOR_MONTHLY = 'prod_creator_monthly';

    await processEvent({
      type: 'payment.succeeded',
      data: {
        id: 'txn_abc123',
        user_id: 'whop_user_1',
        product_id: 'prod_creator_monthly',
        amount: 29.0,
        currency: 'usd',
        created_at: new Date().toISOString(),
      },
    }, { User });

    const invoices = await BillingHistory.find({ userId: user._id }).lean();
    expect(invoices).toHaveLength(1);
    expect(invoices[0].invoice.amount.total).toBe(29);
    expect(invoices[0].invoice.amount.currency).toBe('USD');
    expect(invoices[0].payment.transactionId).toBe('txn_abc123');
    expect(invoices[0].payment.status).toBe('completed');
    expect(invoices[0].status).toBe('paid');
    expect(invoices[0].invoiceNumber).toBeTruthy();

    // A webhook replay must not double-invoice.
    await processEvent({
      type: 'payment.succeeded',
      data: {
        id: 'txn_abc123', user_id: 'whop_user_1', product_id: 'prod_creator_monthly',
        amount: 29.0, currency: 'usd', created_at: new Date().toISOString(),
      },
    }, { User });
    expect(await BillingHistory.countDocuments({ userId: user._id })).toBe(1);

    await BillingHistory.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    delete process.env.WHOP_PRODUCT_ID_CREATOR_MONTHLY;
  });
});

describe('invoice PDF', () => {
  let invoice;

  beforeAll(async () => {
    invoice = await BillingHistory.create({
      userId,
      invoice: {
        date: new Date(),
        period: { start: new Date(), end: new Date(Date.now() + 30 * 86400000) },
        amount: { subtotal: 29, tax: 0, discount: 0, total: 29, currency: 'USD' },
        items: [{ description: 'Click creator (monthly)', quantity: 1, unitPrice: 29, total: 29 }],
      },
      payment: { method: 'other', transactionId: 'txn_pdf', status: 'completed', paidAt: new Date() },
      status: 'paid',
    });
  });

  afterAll(async () => { await BillingHistory.deleteMany({ userId }); });

  it('renders a real PDF instead of returning {url: null}', async () => {
    const res = await downloadInvoicePDF(invoice.invoiceNumber, userId);

    expect(Buffer.isBuffer(res.content)).toBe(true);
    expect(res.content.length).toBeGreaterThan(500);
    // A real PDF starts with the %PDF- magic bytes.
    expect(res.content.subarray(0, 5).toString()).toBe(PDF_MAGIC);
    expect(res.contentType).toBe('application/pdf');
    expect(res.filename).toContain(invoice.invoiceNumber);
  });
});

describe('music compliance PDF', () => {
  it('renders a real PDF instead of "PDF generation not implemented"', async () => {
    const res = await generateComplianceReport(userId, null, { format: 'pdf', includeDetails: true });

    expect(res.format).toBe('pdf');
    expect(Buffer.isBuffer(res.content)).toBe(true);
    expect(res.content.subarray(0, 5).toString()).toBe(PDF_MAGIC);
    expect(res.contentType).toBe('application/pdf');
    // The old shape leaked this apology into the response body.
    expect(res.message).toBeUndefined();
  });
});

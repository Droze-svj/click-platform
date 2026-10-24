// GET /billing/history must return the user's invoices (BillingHistory,
// written by the Whop webhook). It used to return only plan-change requests
// as `changes`, so the billing page's invoice list was always empty.
// The connection + in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const BillingHistory = require('../../../server/models/BillingHistory');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('GET /api/billing/history', () => {
  it('returns only the caller\'s invoices', async () => {
    await User.deleteMany({ email: /billing-history-/ });
    const me = await new User({ email: 'billing-history-me@example.com', password: 'password123', name: 'Me', emailVerified: true }).save();
    const other = await new User({ email: 'billing-history-other@example.com', password: 'password123', name: 'Other', emailVerified: true }).save();
    const invoice = (userId, total) => ({
      userId,
      invoice: { date: new Date(), amount: { subtotal: total, total, currency: 'USD' }, items: [{ description: 'Click pro (monthly)', quantity: 1, unitPrice: total, total }] },
      payment: { method: 'other', transactionId: `tx-${userId}-${total}`, status: 'completed' },
      status: 'paid',
    });
    await BillingHistory.create(invoice(me._id, 29));
    await BillingHistory.create(invoice(other._id, 99));

    const token = jwt.sign({ userId: String(me._id) }, getJwtSecret(), { expiresIn: '1h' });
    const res = await request(app).get('/api/billing/history').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.invoices).toHaveLength(1);
    expect(res.body.data.invoices[0]).toMatchObject({ status: 'paid', invoice: { amount: { total: 29 } } });
    expect(res.body.data.invoices[0].invoiceNumber).toBeTruthy();
    expect(Array.isArray(res.body.data.changes)).toBe(true);
  });
});

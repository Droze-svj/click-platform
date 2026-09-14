const express = require('express');
const request = require('supertest');

const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  email: 'creator@example.com',
  role: 'creator',
};

jest.mock('../../../server/middleware/auth', () => {
  const middleware = (req, res, next) => {
    req.user = mockUser;
    next();
  };
  middleware.authenticateToken = middleware;
  return middleware;
});

jest.mock('../../../server/services/billingHistoryService', () => ({
  getInvoice: jest.fn(async (invoiceNumber, userId) => {
    if (invoiceNumber === 'INV-404') {
      throw new Error('Invoice not found');
    }
    return {
      invoiceNumber,
      userId,
      status: 'paid',
      invoice: {
        date: new Date('2026-09-01'),
        amount: { total: 39, currency: 'USD' },
        items: [{ description: 'Click Creator (monthly)', quantity: 1, total: 39 }]
      }
    };
  }),
  downloadInvoicePDF: jest.fn(async (invoiceNumber, userId) => {
    if (invoiceNumber === 'INV-URL') {
      return { url: 'https://storage.googleapis.com/click-invoices/INV-URL.pdf', invoiceNumber };
    }
    return {
      content: Buffer.from('%PDF-1.4 Mock invoice content'),
      contentType: 'application/pdf',
      filename: `invoice-${invoiceNumber}.pdf`
    };
  }),
  requestInvoiceCorrection: jest.fn(async (invoiceNumber, userId, { reason }) => ({
    success: true,
    invoiceNumber,
    correctionTicket: 'CORR-12345',
    reason
  }))
}));

describe('Billing Invoice Route Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/billing', require('../../../server/routes/billing'));
  });

  describe('GET /api/billing/invoices/:invoiceNumber', () => {
    it('returns invoice details for valid invoice', async () => {
      const res = await request(app).get('/api/billing/invoices/INV-2026-001');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoiceNumber).toBe('INV-2026-001');
      expect(res.body.data.status).toBe('paid');
    });
  });

  describe('GET /api/billing/invoices/:invoiceNumber/download', () => {
    it('downloads PDF as stream with proper headers', async () => {
      const res = await request(app).get('/api/billing/invoices/INV-2026-001/download');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('invoice-INV-2026-001.pdf');
      expect(res.body).toBeInstanceOf(Buffer);
    });

    it('returns JSON payload when invoice has external URL', async () => {
      const res = await request(app).get('/api/billing/invoices/INV-URL/download');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toContain('https://storage.googleapis.com');
    });
  });

  describe('POST /api/billing/invoices/:invoiceNumber/correct', () => {
    it('rejects without reason', async () => {
      const res = await request(app)
        .post('/api/billing/invoices/INV-2026-001/correct')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Reason is required');
    });

    it('submits correction with reason successfully', async () => {
      const res = await request(app)
        .post('/api/billing/invoices/INV-2026-001/correct')
        .send({ reason: 'Incorrect VAT registration number' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.correctionTicket).toBe('CORR-12345');
    });
  });
});

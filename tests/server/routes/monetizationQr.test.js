/**
 * GET /api/monetization/qr — the Monetize tab's "QR code" for a product link
 * (previously a button with no handler).
 */
jest.mock('../../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: '64b000000000000000000001' };
  next();
});
jest.mock('../../../server/services/monetizationService', () => ({}));

const express = require('express');
const request = require('supertest');

const app = express();
app.use('/api/monetization', require('../../../server/routes/monetization'));

describe('GET /api/monetization/qr', () => {
  it('returns a PNG QR code for a product link', async () => {
    const res = await request(app).get('/api/monetization/qr').query({ url: 'https://whop.com/checkout/plan_abc' }).expect(200);
    expect(res.body.data.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('rejects anything that is not an http(s) link', async () => {
    await request(app).get('/api/monetization/qr').query({ url: 'javascript:alert(1)' }).expect(400);
    await request(app).get('/api/monetization/qr').expect(400);
  });
});

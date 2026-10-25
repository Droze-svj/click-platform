const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');
const { trustProxySetting } = require('../../../server/utils/trustProxy');

// Production is visitor → Cloudflare → Render LB → app. Supertest connects
// from 127.0.0.1, which stands in for the (trusted) Render load balancer.
const CF_EDGE = '172.64.10.20';

function appWith(setting, limiter) {
  const app = express();
  app.set('trust proxy', setting);
  if (limiter) app.use(limiter);
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return app;
}

describe('trust proxy', () => {
  const app = appWith(trustProxySetting({}));

  it('resolves the visitor behind Cloudflare and the load balancer', async () => {
    const res = await request(app).get('/ip').set('X-Forwarded-For', `203.0.113.5, ${CF_EDGE}`);
    expect(res.body.ip).toBe('203.0.113.5');
  });

  it('ignores an X-Forwarded-For the visitor wrote themselves', async () => {
    const res = await request(app).get('/ip').set('X-Forwarded-For', `6.6.6.6, 203.0.113.5, ${CF_EDGE}`);
    expect(res.body.ip).toBe('203.0.113.5');
  });

  it('uses the caller address when the origin is called directly', async () => {
    const res = await request(app).get('/ip').set('X-Forwarded-For', '6.6.6.6, 198.51.100.7');
    expect(res.body.ip).toBe('198.51.100.7');
  });

  it('gives each visitor their own rate-limit bucket', async () => {
    const limited = appWith(trustProxySetting({}), rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false }));
    const as = (ip) => request(limited).get('/ip').set('X-Forwarded-For', `${ip}, ${CF_EDGE}`);
    await as('203.0.113.5');
    await as('203.0.113.5');
    expect((await as('203.0.113.5')).status).toBe(429);
    expect((await as('198.51.100.7')).status).toBe(200);
  });

  it('honours TRUST_PROXY overrides', () => {
    expect(trustProxySetting({ TRUST_PROXY: 'false' })).toBe(false);
    expect(trustProxySetting({ TRUST_PROXY: '2' })).toBe(2);
    expect(trustProxySetting({ TRUST_PROXY: '10.0.0.1, loopback' })).toEqual(['10.0.0.1', 'loopback']);
  });
});

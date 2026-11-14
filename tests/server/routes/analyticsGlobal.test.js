// GET /api/analytics/global used to return invented marketing numbers
// (25,000 creators / 145M clips when a count failed, plus an always-fake 312%
// "brand lift" and 99.9% uptime) under source "live". Only measured counts now.

const request = require('supertest');
const app = require('../../../server/index');
const User = require('../../../server/models/User');

describe('GET /api/analytics/global', () => {
  it('returns measured counts and nothing invented', async () => {
    const res = await request(app).get('/api/analytics/global');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('live');
    expect(typeof res.body.accounts).toBe('number');
    expect(typeof res.body.videos).toBe('number');
    expect(res.body).not.toHaveProperty('brandLiftPct');
    expect(res.body).not.toHaveProperty('uptimePct');
    expect(res.body).not.toHaveProperty('creators');
    expect(res.body).not.toHaveProperty('clipsGenerated');
  });

  it('reports a failed count as null, never a made-up number', async () => {
    const spy = jest.spyOn(User, 'countDocuments').mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/api/analytics/global');
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(res.body.accounts).toBeNull();
    expect(res.body.source).toBe('unavailable');
    expect(JSON.stringify(res.body)).not.toMatch(/25000|145000000/);
  });
});

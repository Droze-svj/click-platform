/**
 * GET /api/health must not spend AI quota.
 *
 * It used to make a real Gemini call every time a 60s cache expired, and the
 * repo's own keep-alive guide pointed an uptime monitor at it every 5 minutes —
 * 288 requests a day against a 20/day free tier, so the health checks alone used
 * up the AI quota. A readiness probe that burns the resource it reports on is a
 * production outage on a timer. These pin that the default probe is free and the
 * real round-trip only happens when explicitly asked for.
 */

jest.mock('../../../server/utils/aiRouter', () => ({
  aiCall: jest.fn(async () => ({ text: 'ok', provider: 'gemini' })),
}));
jest.mock('../../../server/utils/googleAI', () => ({
  isConfigured: true,
  generateContent: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { aiCall } = require('../../../server/utils/aiRouter');

describe('GET /api/health — Gemini dependency', () => {
  let app;
  const prevKey = process.env.GOOGLE_AI_API_KEY;

  beforeAll(() => {
    // Configured, so the probe reaches the branch that USED to call the model.
    process.env.GOOGLE_AI_API_KEY = 'test-key-not-real';
    app = express();
    app.use('/api/health', require('../../../server/routes/health'));
  });

  afterAll(() => {
    if (prevKey === undefined) delete process.env.GOOGLE_AI_API_KEY;
    else process.env.GOOGLE_AI_API_KEY = prevKey;
  });

  beforeEach(() => aiCall.mockClear());

  it('makes NO AI request, however often it is polled', async () => {
    // An uptime monitor polling every few minutes looks exactly like this.
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/api/health');
      expect(res.body.deps.gemini).toMatchObject({ configured: true, liveTest: 'skipped' });
    }
    expect(aiCall).not.toHaveBeenCalled();
  }, 60000);

  it('still reports whether Gemini is configured', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.deps.gemini.configured).toBe(true);
    expect(res.body.deps.gemini.hint).toMatch(/live=1/);
  }, 30000);

  it('does not let Gemini gate readiness', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.failures || []).not.toContain('gemini');
  }, 30000);

  it('reports an unconfigured key honestly, still without calling the model', async () => {
    const saved = process.env.GOOGLE_AI_API_KEY;
    process.env.GOOGLE_AI_API_KEY = '';
    try {
      const res = await request(app).get('/api/health');
      expect(res.body.deps.gemini).toMatchObject({ configured: false, connected: false });
      expect(aiCall).not.toHaveBeenCalled();
    } finally {
      process.env.GOOGLE_AI_API_KEY = saved;
    }
  }, 30000);
});

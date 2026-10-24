/**
 * Production is MongoDB-only, so the creator-analytics and engagement
 * command-center routes must read published ScheduledPosts (they only queried
 * Supabase and were always empty in production). The command center must not
 * spend an AI call per post.
 */
const USER = '64b000000000000000000001';
jest.mock('../../../server/middleware/auth', () => (req, res, next) => { req.user = { _id: USER, id: USER }; next(); });

const mockFind = jest.fn();
jest.mock('../../../server/models/ScheduledPost', () => ({
  find: (...args) => {
    mockFind(...args);
    const rows = mockFind.rows || [];
    const chain = { sort: () => chain, limit: (n) => { chain._n = n; return chain; }, select: () => chain, lean: async () => rows.slice(0, chain._n || rows.length) };
    return chain;
  },
}));

const mockAdvice = jest.fn(async (type, ctx, opts) => ({ action: `advice:${type}:${opts && opts.allowAI ? 'ai' : 'builtin'}`, reasoning: '', urgency: '' }));
jest.mock('../../../server/services/engagementAnomalyService', () => {
  const real = jest.requireActual('../../../server/services/engagementAnomalyService');
  return { ...real, generateAnomalyAdvice: (...a) => mockAdvice(...a) };
});

const express = require('express');
const request = require('supertest');

function post(id, views, extra = {}) {
  return {
    _id: id, platform: 'tiktok', postedAt: new Date(Date.now() - 200 * 3600000),
    content: { text: `Post ${id}\nmore` },
    analytics: { impressions: views, engagementBreakdown: { views, likes: 10, comments: 2, shares: 1 }, engagementRate: { byReach: 4.5 } },
    ...extra,
  };
}

let app;
beforeAll(() => {
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  app = express();
  app.use('/api/analytics', require('../../../server/routes/analytics/core'));
});
beforeEach(() => { mockFind.mockClear(); mockAdvice.mockClear(); });

describe('analytics routes on a Mongo-only stack', () => {
  it('creator stats lists the user\'s real published posts', async () => {
    mockFind.rows = [post('a1', 1200), post('a2', 300)];
    const res = await request(app).get('/api/analytics/creator/stats').expect(200);
    expect(mockFind).toHaveBeenCalledWith({ userId: USER, status: 'posted' });
    expect(res.body.stats.map((s) => [s.id, s.title, s.views, s.engagementRate])).toEqual([
      ['a1', 'Post a1', 1200, 4.5],
      ['a2', 'Post a2', 300, 4.5],
    ]);
  });

  it('command center: anomalies detected locally, AI only for real anomalies (max 3)', async () => {
    // views>500, slow velocity after >6h → drop_off anomaly for each
    mockFind.rows = [1, 2, 3, 4, 5].map((i) => post(`p${i}`, 600 + i));
    const res = await request(app).get('/api/analytics/engagement/command-center').expect(200);
    const posts = res.body.data.posts;
    expect(posts).toHaveLength(5);
    expect(posts.every((p) => p.anomalyType === 'drop_off')).toBe(true);
    const aiCalls = mockAdvice.mock.calls.filter((c) => c[2] && c[2].allowAI);
    expect(aiCalls).toHaveLength(3);
    expect(posts[0].anomalyAdvice.action).toMatch(/^advice:drop_off/);
  });

  it('command center: no anomaly → no AI call', async () => {
    mockFind.rows = [post('q1', 0)];
    await request(app).get('/api/analytics/engagement/command-center').expect(200);
    expect(mockAdvice.mock.calls.filter((c) => c[2] && c[2].allowAI)).toHaveLength(0);
  });
});

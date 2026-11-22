/**
 * /api/analytics/creator/stats (routes/analytics/creator.js, the one the
 * Analytics page's "Recent posts" list reads) fell back to analytics.engagement
 * for views — every post synced from X showed likes+replies as its views and a
 * 100% engagement rate.
 */
const USER = '64b000000000000000000002';
jest.mock('../../../server/middleware/auth', () => (req, res, next) => { req.user = { _id: USER, id: USER }; next(); });

const mockRows = [];
jest.mock('../../../server/models/ScheduledPost', () => ({
  find: () => {
    const chain = { sort: () => chain, limit: () => chain, select: () => chain, lean: async () => mockRows };
    return chain;
  },
}));
jest.mock('../../../server/models/Content', () => ({
  find: () => ({ select: () => ({ lean: async () => [] }) }),
}));

const express = require('express');
const request = require('supertest');

it('reports real views and engagement rate for an X post synced with impressions only', async () => {
  mockRows.push({
    _id: 'x1', platform: 'twitter', status: 'posted', postedAt: new Date(),
    content: { text: 'Morning routine that actually moves the needle' },
    analytics: { impressions: 4218, engagement: 387, engagementBreakdown: { likes: 312, comments: 28, shares: 47 } },
  });
  const app = express();
  app.use('/api/analytics/creator', require('../../../server/routes/analytics/creator'));
  const res = await request(app).get('/api/analytics/creator/stats').expect(200);
  expect(res.body.stats[0]).toMatchObject({ id: 'x1', views: 4218, likes: 312, comments: 28, shares: 47, engagementRate: 9.17 });
});

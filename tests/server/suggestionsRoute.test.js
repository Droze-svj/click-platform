// /api/suggestions/* now serves the REAL personalized engine
// (contentSuggestionsService) instead of a hardcoded array. These lock in: real
// ideas + a content-gap nudge are shaped through; the old static suggestions are
// gone; dev users get an honest empty cold-start (no AI call).

jest.mock('../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: req.headers['x-uid'] || 'realuser' };
  next();
});
jest.mock('../../server/services/contentSuggestionsService', () => ({
  generateDailyContentIdeas: jest.fn(),
  analyzeContentGaps: jest.fn(),
  getTrendingTopics: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const svc = require('../../server/services/contentSuggestionsService');
const router = require('../../server/routes/suggestions');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/suggestions', router);
  return app;
}

describe('/api/suggestions/daily — real personalized engine', () => {
  beforeEach(() => {
    svc.generateDailyContentIdeas.mockReset();
    svc.analyzeContentGaps.mockReset();
  });

  it('shapes REAL ideas + a content-gap nudge (the old hardcoded array is gone)', async () => {
    svc.generateDailyContentIdeas.mockResolvedValue([
      { title: '5 finance mistakes', description: 'Listicle', platforms: ['tiktok'], hashtags: ['#finance'], contentType: 'video' },
    ]);
    svc.analyzeContentGaps.mockResolvedValue([{ platform: 'twitter', count: 0, recommendation: 'Add twitter' }]);

    const res = await request(makeApp()).get('/api/suggestions/daily').set('x-uid', '6a3500000000000000000aaa');
    const data = res.body.data;
    expect(svc.generateDailyContentIdeas).toHaveBeenCalled();
    expect(data.some((s) => s.title === '5 finance mistakes')).toBe(true);
    expect(data.some((s) => /twitter/i.test(s.title))).toBe(true);            // gap nudge
    expect(data.some((s) => s.title === 'Trending Topic: AI in Content Creation')).toBe(false); // old static gone
  });

  it('honest cold-start for dev users (empty, no AI call)', async () => {
    const res = await request(makeApp()).get('/api/suggestions/daily').set('x-uid', 'dev-user-123');
    expect(res.body.data).toEqual([]);
    expect(svc.generateDailyContentIdeas).not.toHaveBeenCalled();
  });

  it('/daily-ideas + /content-gaps proxy the real service', async () => {
    svc.generateDailyContentIdeas.mockResolvedValue([{ title: 'idea A' }]);
    svc.analyzeContentGaps.mockResolvedValue([{ platform: 'youtube', count: 1 }]);
    const a = await request(makeApp()).get('/api/suggestions/daily-ideas').set('x-uid', '6a3500000000000000000bbb');
    expect(a.body.data[0].title).toBe('idea A');
    const g = await request(makeApp()).get('/api/suggestions/content-gaps').set('x-uid', '6a3500000000000000000bbb');
    expect(g.body.data[0].platform).toBe('youtube');
  });
});

/**
 * GET /api/content-operations/health/suggestions
 *
 * `count` went straight into parseInt with no ceiling, so ?count=1000 asked for
 * 1000 AI-generated ideas (then one Gemini request each), and the route had no
 * AI rate limiter. It is now clamped to 1..10, sits behind aiLimiter, and says
 * plainly when the model produced nothing instead of returning an empty list as
 * if there were no suggestions to make.
 */

const mockGetFutureContentSuggestions = jest.fn();
const mockPerformContentHealthCheck = jest.fn();
const mockAiLimiter = jest.fn((req, res, next) => next());

jest.mock('../../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: 'user-1' };
  next();
});
jest.mock('../../../server/middleware/enhancedRateLimiter', () => ({
  aiLimiter: (...args) => mockAiLimiter(...args),
}));
jest.mock('../../../server/services/contentHealthService', () => ({
  performContentHealthCheck: (...args) => mockPerformContentHealthCheck(...args),
  getFutureContentSuggestions: (...args) => mockGetFutureContentSuggestions(...args),
  monitorContentHealth: jest.fn(),
  autoOptimizeContent: jest.fn(),
  predictFutureGaps: jest.fn(),
  analyzeContentAttribution: jest.fn(),
  analyzeHistoricalTrends: jest.fn(),
  getContentRefreshRecommendations: jest.fn(),
}));
jest.mock('../../../server/services/adaptivePerformanceService', () => ({
  getAdaptivePerformancePrediction: jest.fn(),
  updatePredictionsWithNewData: jest.fn(),
}));
jest.mock('../../../server/services/competitiveBenchmarkingService', () => ({
  getCompetitiveBenchmarks: jest.fn(),
  getNextWeekRecommendations: jest.fn(),
  trackCompetitors: jest.fn(),
  compareWithCompetitors: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const router = require('../../../server/routes/content-operations');

const app = express();
app.use('/api/content-operations', router);

const SUGGESTION = { id: 's1', platform: 'tiktok', title: 'T', idea: 'An idea', confidence: null };

describe('GET /api/content-operations/health/suggestions', () => {
  beforeEach(() => {
    mockGetFutureContentSuggestions.mockReset().mockResolvedValue([SUGGESTION]);
    mockPerformContentHealthCheck.mockReset().mockResolvedValue({ gaps: [], overallScore: 72 });
    mockAiLimiter.mockClear();
  });

  const countPassed = () => mockGetFutureContentSuggestions.mock.calls[0][2];

  it.each([
    ['1000', 10],
    ['abc', 10],
    ['0', 1],
    ['-5', 1],
    ['3', 3],
  ])('clamps count=%s to %d', async (count, expected) => {
    await request(app).get(`/api/content-operations/health/suggestions?count=${count}`).expect(200);
    expect(countPassed()).toBe(expected);
  });

  it('defaults to 10 when no count is given', async () => {
    await request(app).get('/api/content-operations/health/suggestions').expect(200);
    expect(countPassed()).toBe(10);
  });

  it('runs behind the AI rate limiter', async () => {
    await request(app).get('/api/content-operations/health/suggestions').expect(200);
    expect(mockAiLimiter).toHaveBeenCalledTimes(1);
  });

  it('reports suggestions normally when there are some', async () => {
    const res = await request(app).get('/api/content-operations/health/suggestions?count=1').expect(200);
    expect(res.body.message).toBe('Content suggestions generated');
    expect(res.body.data).toMatchObject({ suggestions: [SUGGESTION], degraded: false, basedOn: { healthScore: 72 } });
  });

  it('says the suggestions are unavailable when the model produced nothing', async () => {
    mockGetFutureContentSuggestions.mockResolvedValue([]);
    const res = await request(app).get('/api/content-operations/health/suggestions?count=3').expect(200);
    expect(res.body.message).toBe('Content suggestions temporarily unavailable');
    expect(res.body.data).toMatchObject({ suggestions: [], degraded: true });
  });
});

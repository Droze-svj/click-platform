// Two routes that used to report invented values:
//
//  - GET /api/phase10_12/fleet/health hardcoded
//      cache: { status: 'connected', type: 'Redis', latency: '4ms' }
//      queue: { status: 'active', type: 'BullMQ' }
//    regardless of whether Redis existed. It now probes the shared Redis client
//    and the BullMQ connection and reports what it finds.
//
//  - GET /api/competitive/benchmarks answered every failure with success:true
//    and invented industry bands (median 300 / top25 1000 / "+20% reach"),
//    flagged only by an `_mock` field no client read. It now returns 503.

const express = require('express');
const request = require('supertest');

jest.mock('../../../server/middleware/auth', () => {
  const auth = (req, _res, next) => { req.user = { id: 'u1', _id: 'u1' }; next(); };
  auth.authenticate = auth;
  auth.authenticateToken = auth;
  return auth;
});
jest.mock('../../../server/middleware/tierGate', () => ({
  requireFeature: () => (_req, _res, next) => next(),
  addTierContext: (_req, _res, next) => next(),
}));
jest.mock('../../../server/services/competitiveBenchmarkingService', () => ({
  getCompetitiveBenchmarks: jest.fn(),
  getNextWeekRecommendations: jest.fn(),
  trackCompetitors: jest.fn(),
  compareWithCompetitors: jest.fn(),
}));
jest.mock('../../../server/utils/redisCache', () => ({ isConnected: false, client: null }));
jest.mock('../../../server/services/jobQueueService', () => ({
  getRedisConnection: jest.fn(() => null),
  getQueueStats: jest.fn(),
}));

const benchmarking = require('../../../server/services/competitiveBenchmarkingService');
const redisCache = require('../../../server/utils/redisCache');
const jobQueue = require('../../../server/services/jobQueueService');

function appWith(path, router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  return app;
}

describe('GET /fleet/health reports real dependency status', () => {
  const app = appWith('/api/phase10_12', require('../../../server/routes/phase10_12'));

  afterEach(() => {
    redisCache.isConnected = false;
    redisCache.client = null;
    jobQueue.getRedisConnection.mockReturnValue(null);
  });

  it('does not claim Redis/BullMQ are up when they are not configured', async () => {
    const res = await request(app).get('/api/phase10_12/fleet/health').expect(200);
    expect(res.body.cache.status).not.toBe('connected');
    expect(res.body.cache.latency).toBeNull();
    expect(res.body.queue.status).toBe('not configured');
    expect(res.body.queue.pending).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('4ms');
    expect(JSON.stringify(res.body)).not.toContain('v3.1.0');
  });

  it('reports a measured latency and real queue depth when they are up', async () => {
    redisCache.isConnected = true;
    redisCache.client = { ping: jest.fn().mockResolvedValue('PONG') };
    jobQueue.getRedisConnection.mockReturnValue({ host: 'x' });
    jobQueue.getQueueStats.mockResolvedValue({ waiting: 7 });

    const res = await request(app).get('/api/phase10_12/fleet/health').expect(200);
    expect(res.body.cache.status).toBe('connected');
    expect(res.body.cache.latency).toMatch(/^\d+ms$/);
    expect(res.body.queue).toMatchObject({ status: 'active', pending: 7 });
  });

  it('reports an error rather than "connected" when the ping fails', async () => {
    redisCache.isConnected = true;
    redisCache.client = { ping: jest.fn().mockRejectedValue(new Error('ECONNRESET')) };
    const res = await request(app).get('/api/phase10_12/fleet/health').expect(200);
    expect(res.body.cache.status).toBe('error');
  });
});

describe('GET /competitive/benchmarks never invents industry bands', () => {
  const app = appWith('/api/competitive', require('../../../server/routes/competitive-benchmark'));

  it('returns 503 with a message when the benchmark cannot be computed', async () => {
    benchmarking.getCompetitiveBenchmarks.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/api/competitive/benchmarks?platform=tiktok').expect(503);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.data).toBeUndefined();
    expect(res.body._mock).toBeUndefined();
  });

  it('passes real data through unchanged on success', async () => {
    const data = { user: { avgEngagement: 12 }, industry: { median: 40 } };
    benchmarking.getCompetitiveBenchmarks.mockResolvedValue(data);
    const res = await request(app).get('/api/competitive/benchmarks').expect(200);
    expect(res.body).toEqual({ success: true, data });
  });
});

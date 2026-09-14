const express = require('express');
const request = require('supertest');

const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  avatar: 'https://example.com/profiles/avatar_creator.png',
  role: 'creator',
};

// Mock auth middleware so unit tests can run standalone
jest.mock('../../../server/middleware/auth', () => {
  const middleware = (req, res, next) => {
    req.user = mockUser;
    next();
  };
  middleware.authenticateToken = middleware;
  return middleware;
});

const digitalTwinService = require('../../../server/services/digitalTwinService');

describe('Digital Twin & User Style Profile Route Enhancements', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mount the routers
    app.use('/api/digital-twin', require('../../../server/routes/digitalTwin'));
    app.use('/api/style-profile', require('../../../server/routes/userStyleProfile'));
  });

  beforeEach(() => {
    digitalTwinService.generationJobs.clear();
    delete process.env.HEYGEN_API_KEY;
    delete process.env.SORA_API_KEY;
    delete process.env.SORA_GATEWAY_URL;
    digitalTwinService.heygenApiKey = undefined;
    digitalTwinService.soraApiKey = undefined;
  });

  describe('GET /api/digital-twin/providers', () => {
    it('returns available digital twin providers and defaults', async () => {
      const res = await request(app).get('/api/digital-twin/providers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('heygen');
      expect(res.body.data).toHaveProperty('sora');
      expect(res.body.data).toHaveProperty('localAi');
      expect(res.body.data.localAi.available).toBe(true);
    });
  });

  describe('POST /api/digital-twin/generate & GET /api/digital-twin/jobs', () => {
    it('validates voiceNoteUrl', async () => {
      const res = await request(app)
        .post('/api/digital-twin/generate')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('voiceNoteUrl');
    });

    it('creates job, records it in registry, and auto-injects user avatar', async () => {
      const res = await request(app)
        .post('/api/digital-twin/generate')
        .send({
          voiceNoteUrl: 'https://example.com/myaudio.mp3',
          options: { provider: 'simulated' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      const jobId = res.body.data.id;

      // Check job list endpoint
      const listRes = await request(app).get('/api/digital-twin/jobs');
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      const created = listRes.body.data.find(j => j.id === jobId);
      expect(created).toBeDefined();

      // Check delete job endpoint
      const delRes = await request(app).delete(`/api/digital-twin/jobs/${jobId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(digitalTwinService.generationJobs.has(jobId)).toBe(false);
    });
  });

  describe('GET /api/style-profile/recommendations & POST /reset', () => {
    it('returns baseline recommended style parameters for creator', async () => {
      const res = await request(app).get('/api/style-profile/recommendations');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('recommendedFont');
      expect(res.body.data).toHaveProperty('recommendedCaptionStyle');
      expect(res.body.data).toHaveProperty('recommendedColorGrade');
      expect(res.body.data).toHaveProperty('avgCutDuration');
      expect(typeof res.body.data.confidence).toBe('number');
    });

    it('handles taste profile reset', async () => {
      const res = await request(app)
        .post('/api/style-profile/reset')
        .send({ facet: 'fonts' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

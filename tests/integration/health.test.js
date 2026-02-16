// Integration tests for GET /api/health (Phase 1 — Testing & QA)

const request = require('supertest');
const createTestApp = require('./test-server-setup');

const app = createTestApp();

describe('Health API', () => {
  describe('GET /api/health', () => {
    it('should return 200 and status ok', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should include timestamp and uptime', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should include responseTime and environment', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toHaveProperty('responseTime');
      expect(response.body).toHaveProperty('environment');
    });
  });
});

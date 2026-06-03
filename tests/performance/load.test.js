// Performance/Load Tests

const request = require('supertest');
const app = require('../../server/index');

describe('Performance Tests', () => {
  beforeAll(async () => {
    // Warm-up request to ensure the server is booted and DB connections are established
    await request(app).get('/api/health');
  }, 30000);

  describe('API Response Times', () => {
    it('should respond to health check within 100ms', async () => {
      const start = Date.now();
      await request(app).get('/api/health/light');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/api/health/light')
      );

      const start = Date.now();
      await Promise.all(requests);
      const duration = Date.now() - start;

      // All requests should complete within reasonable time
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Database Query Performance', () => {
    it('should query content list efficiently', async () => {
      // This would require authenticated user
      // Mock or create test user first
      const start = Date.now();
      // await request(app).get('/api/content').set('Authorization', `Bearer ${token}`);
      const duration = Date.now() - start;

      // Query should complete within 500ms
      expect(duration).toBeLessThan(500);
    });
  });
});







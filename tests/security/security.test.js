// Security Tests

const request = require('supertest');
const app = require('../../server/index');

describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should reject SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      await request(app)
        .post('/api/auth/register')
        .send({
          email: maliciousInput,
          password: 'password123',
          name: 'Test',
        })
        .expect(400);
    });

    it('should reject XSS attempts', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: xssPayload,
        })
        .expect(400);
    });
  });

  describe('Authentication Security', () => {
    it('should require authentication for protected routes', async () => {
      await request(app)
        .get('/api/content')
        .expect(401);
    });

    it('should reject invalid tokens', async () => {
      await request(app)
        .get('/api/content')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject expired tokens', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'test' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(110).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const responses = await Promise.allSettled(requests);
      const rateLimited = responses.filter(
        r => r.status === 'fulfilled' && r.value.status === 429
      );

      // Should have some rate limited requests
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('CORS', () => {
    it('should have proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/health')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});







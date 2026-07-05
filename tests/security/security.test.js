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

  // Rate-limit stays skipped: it hits /api/health (intentionally on the bypass
  // list — health checks are never rate-limited), and 110 < the 300 cap anyway;
  // a meaningful test needs a non-bypassed route + a 300+ burst AND a live Redis
  // store (the limiter fails OPEN without one — see enhancedRateLimiter). Not
  // worth the slow/flaky burst here.
  describe.skip('Rate Limiting', () => {
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
    // A preflight must carry an Origin — the cors module spec-correctly omits
    // Access-Control-Allow-Origin when the client never claimed one. (The prior
    // test sent no Origin, so it was skipped.)
    it('echoes an allowed Origin on preflight', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});







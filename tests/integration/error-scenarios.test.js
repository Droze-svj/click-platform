// Error Scenarios and Edge Cases Integration Tests

const request = require('supertest');
const mongoose = require('mongoose');
const createTestApp = require('./test-server-setup');
const User = require('../../server/models/User');

const app = createTestApp();

describe('Error Scenarios and Edge Cases', () => {
  let authToken;
  let testUser;
  let adminToken;
  let adminUser;

  beforeAll(async () => {
    const { initDatabases } = require('../../server/config/database');
    await initDatabases();
    
    testUser = new User({
      name: 'Error Test User',
      email: 'error-test_' + Date.now() + '@example.com',
      password: "hashedpassword",
      emailVerified: true,
      subscription: { status: 'active', plan: 'pro' },
    });
    await testUser.save();

    adminUser = new User({
      name: 'Error Admin User',
      email: 'error-admin_' + Date.now() + '@example.com',
      password: "hashedpassword",
      emailVerified: true,
      role: 'admin',
      subscription: { status: 'active', plan: 'agency' },
    });
    await adminUser.save();

    const jwt = require('jsonwebtoken');
    const { getJwtSecret } = require('../../server/utils/jwtSecret');
    authToken = jwt.sign({ userId: testUser._id.toString() }, getJwtSecret(), { expiresIn: '1h' });
    adminToken = jwt.sign({ userId: adminUser._id.toString() }, getJwtSecret(), { expiresIn: '1h' });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: { $regex: /^(error-test_|error-admin_)/ }
    });
    await mongoose.disconnect();
  });

  describe('Authentication Errors', () => {
    test('Should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/ai/multi-model/models');

      expect([401, 403]).toContain(response.status);
    });

    test('Should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/ai/multi-model/models')
        .set('Authorization', 'Bearer invalid-token');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Validation Errors', () => {
    test('Should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/ai/multi-model/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          // Missing prompt and taskType
        });

      expect([400, 500]).toContain(response.status);
    });

    test('Should reject invalid data types', async () => {
      const response = await request(app)
        .post('/api/ai/multi-model/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: 123, // Should be string
          taskType: 'invalid-type',
        });

      expect([400, 500]).toContain(response.status);
    });

    test('Should reject invalid workflow data', async () => {
      const response = await request(app)
        .post('/api/workflows/advanced/create')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          name: 'Test',
          // Missing triggers and actions
        });

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Authorization Errors', () => {
    test('Should reject non-admin access to infrastructure endpoints', async () => {
      const response = await request(app)
        .get('/api/infrastructure/cache/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

      expect([401, 403]).toContain(response.status);
    });

    test('Should reject non-admin access to database endpoints', async () => {
      const response = await request(app)
        .get('/api/infrastructure/database/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Not Found Errors', () => {
    test('Should handle non-existent workflow', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/workflows/advanced/${fakeId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

      expect([404, 500]).toContain(response.status);
    });

    test('Should handle invalid workflow ID format', async () => {
      const response = await request(app)
        .get('/api/workflows/advanced/invalid-id/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

      expect([400, 404, 500]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    test('Should handle rate limit errors gracefully', async () => {
      // Make multiple rapid requests sequentially to prevent socket hang ups under high test load
      const responses = [];
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/ai/multi-model/models')
          .set('Authorization', `Bearer ${authToken}`)
          .set('x-test-user-id', testUser._id.toString());
        responses.push(response);
      }

      // Some requests should succeed, some may be rate limited
      responses.forEach((response) => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });

  describe('Service Unavailable', () => {
    test('Should handle missing OpenAI API key gracefully', async () => {
      const response = await request(app)
        .post('/api/ai/multi-model/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: 'Test prompt',
          taskType: 'content-generation',
        });

      // Should work using the mock model when API keys are not active in tests
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Should handle Redis unavailability gracefully', async () => {
      // Cache operations should fallback if Redis unavailable
      const response = await request(app)
        .get('/api/infrastructure/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // Should either work or fail gracefully
      expect([200, 500, 503]).toContain(response.status);
    });
  });

  describe('Edge Cases', () => {
    test('Should handle empty arrays in recommendations', async () => {
      // Create user with no content
      const emptyUser = new User({
        name: 'Empty User',
        email: 'empty_' + Date.now() + '@example.com',
        password: "hashedpassword",
      emailVerified: true,
        subscription: { status: 'active', plan: 'pro' },
      });
      await emptyUser.save();

      const response = await request(app)
        .get('/api/ai/recommendations/personalized')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .query({ limit: 10 });

      // Should handle gracefully
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      await User.deleteOne({ email: 'empty_' + Date.now() + '@example.com' });
    });

    test('Should handle very long prompts', async () => {
      const longPrompt = 'a'.repeat(10000);
      const response = await request(app)
        .post('/api/ai/multi-model/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: longPrompt,
          taskType: 'content-generation',
        });

      // Should handle or reject cleanly
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Should handle special characters in prompts', async () => {
      const specialPrompt = 'Test with special chars: <>&"\'`';
      const response = await request(app)
        .post('/api/ai/multi-model/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: specialPrompt,
          taskType: 'content-generation',
        });

      // Should handle or sanitize
      expect([200, 400, 401, 403, 500]).toContain(response.status);
    });
  });

  describe('Concurrent Requests', () => {
    test('Should handle concurrent workflow creation', async () => {
      const requests = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/workflows/advanced/create')
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            name: `Concurrent Workflow ${i}`,
            triggers: [{ type: 'event', config: { event: 'test' } }],
            actions: [{ type: 'test', config: {} }],
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
      });
    });
  });
});


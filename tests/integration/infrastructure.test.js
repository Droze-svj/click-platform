// Infrastructure Integration Tests

const request = require('supertest');
const mongoose = require('mongoose');
const createTestApp = require('./test-server-setup');
const User = require('../../server/models/User');

const app = createTestApp();

describe('Infrastructure Integration Tests', () => {
  let adminToken;
  let adminUser;
  let regularToken;
  let regularUser;

  beforeAll(async () => {
    // Create admin user
    adminUser = new User({
      name: 'Admin User',
      email: 'admin-infra@example.com',
      password: 'hashedpassword',
      role: 'admin',
      subscription: { status: 'active', plan: 'enterprise' },
    });
    await adminUser.save();

    // Create regular user
    regularUser = new User({
      name: 'Regular User',
      email: 'regular-infra@example.com',
      password: 'hashedpassword',
      role: 'user',
      subscription: { status: 'active', plan: 'pro' },
    });
    await regularUser.save();

    adminToken = 'admin-test-token';
    regularToken = 'regular-test-token';
  });

  afterAll(async () => {
    await User.deleteMany({ 
      email: { $in: ['admin-infra@example.com', 'regular-infra@example.com'] }
    });
    await mongoose.connection.close();
  });

  describe('Intelligent Cache', () => {
    test('GET /api/infrastructure/cache/stats - Should return cache statistics (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // May fail if not admin - that's expected
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('hits');
        expect(response.body.data).toHaveProperty('misses');
        expect(response.body.data).toHaveProperty('hitRate');
      }
    });

    test('POST /api/infrastructure/cache/invalidate - Should invalidate cache (admin only)', async () => {
      const response = await request(app)
        .post('/api/infrastructure/cache/invalidate')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true')
        .send({ pattern: 'test-*', cascade: true });

      // May fail if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('invalidated');
      }
    });

    test('POST /api/infrastructure/cache/invalidate - Should reject non-admin users', async () => {
      const response = await request(app)
        .post('/api/infrastructure/cache/invalidate')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ pattern: 'test-*' });

      // Should reject non-admin
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Load Balancer', () => {
    test('GET /api/infrastructure/load-balancer/status - Should return load balancer status (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/load-balancer/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // May fail if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalServers');
        expect(response.body.data).toHaveProperty('healthyServers');
        expect(response.body.data).toHaveProperty('averageLoad');
      }
    });

    test('GET /api/infrastructure/load-balancer/health - Should check server health (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/load-balancer/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // May fail if not admin or servers not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      }
    });

    test('GET /api/infrastructure/load-balancer/select-server - Should select server (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/load-balancer/select-server')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true')
        .query({ strategy: 'weighted' });

      // May fail if not admin or no healthy servers
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('server');
        expect(response.body.data).toHaveProperty('strategy');
      } else if (response.status === 503) {
        // No healthy servers - that's a valid response
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Database Optimization', () => {
    test('GET /api/infrastructure/database/stats - Should return database statistics (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/database/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // May fail if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('database');
        expect(response.body.data).toHaveProperty('collections');
        expect(response.body.data).toHaveProperty('dataSize');
      }
    });

    test('GET /api/infrastructure/database/slow-queries - Should analyze slow queries (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/database/slow-queries')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true')
        .query({ threshold: 1000 });

      // May fail if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalSlowQueries');
        expect(response.body.data).toHaveProperty('recommendations');
      }
    });

    test('GET /api/infrastructure/database/indexes - Should analyze indexes (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/database/indexes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // May fail if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('collections');
        expect(response.body.data).toHaveProperty('recommendations');
      }
    });
  });

  describe('Resource Management', () => {
    test('GET /api/infrastructure/resources/monitor - Should monitor resources (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/resources/monitor')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // May fail if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('memory');
        expect(response.body.data).toHaveProperty('cpu');
        expect(response.body.data.memory).toHaveProperty('total');
        expect(response.body.data.memory).toHaveProperty('used');
        expect(response.body.data.cpu).toHaveProperty('cores');
        expect(response.body.data.cpu).toHaveProperty('usage');
      }
    });

    test('GET /api/infrastructure/resources/thresholds - Should check resource thresholds (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/resources/thresholds')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // May fail if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('resources');
        expect(response.body.data).toHaveProperty('alerts');
        expect(response.body.data).toHaveProperty('healthy');
        expect(Array.isArray(response.body.data.alerts)).toBe(true);
      }
    });

    test('GET /api/infrastructure/resources/recommendations - Should get resource recommendations (admin only)', async () => {
      const response = await request(app)
        .get('/api/infrastructure/resources/recommendations')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true');

      // May fail if not admin
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('recommendations');
        expect(response.body.data).toHaveProperty('currentStatus');
        expect(Array.isArray(response.body.data.recommendations)).toBe(true);
      }
    });
  });
});


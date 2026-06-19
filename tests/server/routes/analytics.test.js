// Analytics Routes Tests

const request = require('supertest');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const jwt = require('jsonwebtoken');

describe('Analytics Routes', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    testUser = new User({
      email: 'analyticstest@example.com',
      password: 'password123',
      name: 'Analytics Test User',
      emailVerified: true, // auth middleware 403s unverified users
    });
    await testUser.save();

    authToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test content
    await Content.create({
      userId: testUser._id,
      type: 'video',
      title: 'Test Video',
      status: 'completed',
    });
  });

  afterAll(async () => {
    await User.deleteOne({ _id: testUser._id });
    await Content.deleteMany({ userId: testUser._id });
  });

  describe('GET /api/analytics/content', () => {
    it('should get content analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/content')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/analytics/content')
        .expect(401);
    });
  });

  describe('GET /api/analytics/performance/global', () => {
    // NOTE: bare GET /api/analytics/performance is admin-only (requireRole).
    // The per-user metrics surface is /performance/global (auth-only), which
    // degrades to honest zeros (success:true) when no analytics exist yet.
    it('should get global performance metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/performance/global')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});







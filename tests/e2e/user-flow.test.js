// E2E Tests for User Flows

const request = require('supertest');
const app = require('../../server/index');
const User = require('../../server/models/User');
const Content = require('../../server/models/Content');
const mongoose = require('mongoose');

// Increase timeout for E2E user flow tests
jest.setTimeout(60000);

describe('E2E User Flows', () => {
  let authToken;
  let testUser;
  let testUserId;

  let registerEmail;
  let searchtestEmail;

  beforeAll(async () => {
    process.env.AUTO_VERIFY_EMAIL = 'true';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click-test');
    }
    registerEmail = `e2e_${Date.now()}@example.com`;
    searchtestEmail = `searchtest_${Date.now()}@example.com`;
  });

  afterAll(async () => {
    await User.deleteMany({
      email: { $regex: /^(e2e_|searchtest_)/ }
    });
    if (testUserId) {
      await Content.deleteMany({ userId: testUserId });
    }
    await mongoose.disconnect();
  });

  describe('Complete User Registration and Content Creation Flow', () => {
    it('should complete full user journey', async () => {
      // Step 1: Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: registerEmail,
          password: 'TestPassword123!',
          name: 'E2E Test User',
        })
        .expect(201);

      expect(registerResponse.body).toHaveProperty('success', true);
      authToken = registerResponse.body.data.token;
      testUserId = registerResponse.body.data.user.id;

      // Step 2: Get user profile
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('user');

      // Step 3: Create content
      const contentResponse = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'This is a test content for E2E testing that needs to be at least 50 characters long to satisfy validation.',
          title: 'E2E Test Content',
          type: 'article',
          platforms: ['twitter', 'linkedin'],
        })
        .expect(200);

      expect(contentResponse.body).toHaveProperty('success', true);
      expect(contentResponse.body).toHaveProperty('data');
      expect(contentResponse.body.data).toHaveProperty('contentId');

      // Step 4: Get content list
      const listResponse = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body).toHaveProperty('success', true);
      expect(listResponse.body).toHaveProperty('data');
    });
  });

  describe('Content Search and Filter Flow', () => {
    beforeEach(async () => {
      // Create test user and content
      testUser = new User({
        email: searchtestEmail,
        password: 'TestPassword123!',
        name: 'Search Test',
      });
      await testUser.save();
      testUserId = testUser._id;

      await Content.create([
        {
          userId: testUserId,
          type: 'video',
          title: 'Test Video 1',
          status: 'completed',
          tags: ['test', 'video'],
        },
        {
          userId: testUserId,
          type: 'article',
          title: 'Test Article 1',
          status: 'completed',
          tags: ['test', 'article'],
        },
      ]);

      const jwt = require('jsonwebtoken');
      authToken = jwt.sign(
        { userId: testUserId.toString() },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    afterEach(async () => {
      if (testUserId) {
        await User.deleteOne({ _id: testUserId });
        await Content.deleteMany({ userId: testUserId });
      }
    });

    it('should search and filter content', async () => {
      // Search for content
      const searchResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ query: 'Test', type: 'video' })
        .expect(200);

      expect(searchResponse.body).toHaveProperty('success', true);
      expect(searchResponse.body.data).toHaveProperty('results');
    });
  });
});







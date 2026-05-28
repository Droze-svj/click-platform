// OAuth Integration Tests

const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../../server/models/User');
const createTestApp = require('./test-server-setup');
const app = createTestApp();
const jwt = require('jsonwebtoken');

describe('OAuth Integration Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Ensure DB is connected
    const { initDatabases } = require('../../server/config/database');
    await initDatabases();

    // Create test user
    await User.deleteOne({ email: 'oauth-test_' + Date.now() + '@example.com' });
    testUser = new User({
      email: 'oauth-test_' + Date.now() + '@example.com',
      password: 'TestPassword123!',
      name: 'OAuth Test User',
      emailVerified: true,
    });
    await testUser.save();

    authToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await User.deleteOne({ _id: testUser._id });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clear OAuth data before each test
    await User.findByIdAndUpdate(testUser._id, {
      $unset: { 'oauth.twitter': '' }
    });
  });

  describe('Twitter OAuth', () => {
    describe('GET /api/oauth/twitter/authorize', () => {
      it('should return authorization URL when configured', async () => {
        // Mock environment variables
        const originalClientId = process.env.TWITTER_CLIENT_ID;
        const originalClientSecret = process.env.TWITTER_CLIENT_SECRET;
        
        process.env.TWITTER_CLIENT_ID = 'test-client-id';
        process.env.TWITTER_CLIENT_SECRET = 'test-client-secret';

        const response = await request(app)
          .get('/api/oauth/twitter/authorize')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('url');
        expect(response.body.data).toHaveProperty('state');
        expect(response.body.data.url).toContain('twitter.com');

        // Restore original values
        if (originalClientId) process.env.TWITTER_CLIENT_ID = originalClientId;
        if (originalClientSecret) process.env.TWITTER_CLIENT_SECRET = originalClientSecret;
      });

      it('should return error when not configured', async () => {
        const originalClientId = process.env.TWITTER_CLIENT_ID;
        const originalClientSecret = process.env.TWITTER_CLIENT_SECRET;
        
        delete process.env.TWITTER_CLIENT_ID;
        delete process.env.TWITTER_CLIENT_SECRET;

        const response = await request(app)
          .get('/api/oauth/twitter/authorize')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(503);

        expect(response.body.success).toBe(false);

        // Restore
        if (originalClientId) process.env.TWITTER_CLIENT_ID = originalClientId;
        if (originalClientSecret) process.env.TWITTER_CLIENT_SECRET = originalClientSecret;
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/oauth/twitter/authorize')
          .expect(401);
      });
    });

    describe('GET /api/oauth/twitter/status', () => {
      it('should return connection status', async () => {
        const response = await request(app)
          .get('/api/oauth/twitter/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('connected');
        expect(response.body.data).toHaveProperty('configured');
        expect(typeof response.body.data.connected).toBe('boolean');
      });

      it('should show connected when OAuth is connected', async () => {
        // Simulate connected state
        await User.findByIdAndUpdate(testUser._id, {
          $set: {
            'oauth.twitter.connected': true,
            'oauth.twitter.connectedAt': new Date(),
            'oauth.twitter.platformUserId': 'test-twitter-user',
          }
        });

        const response = await request(app)
          .get('/api/oauth/twitter/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data.connected).toBe(true);
        expect(response.body.data.connectedAt).toBeDefined();
      });
    });

    describe('DELETE /api/oauth/twitter/disconnect', () => {
      it('should disconnect Twitter account', async () => {
        // First, simulate connected state
        await User.findByIdAndUpdate(testUser._id, {
          $set: {
            'oauth.twitter.connected': true,
            'oauth.twitter.accessToken': 'test-token',
            'oauth.twitter.platformUserId': 'test-twitter-user',
          }
        });

        const response = await request(app)
          .delete('/api/oauth/twitter/disconnect')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify disconnected
        const user = await User.findById(testUser._id);
        expect(user.oauth?.twitter?.connected).toBeFalsy();
      });
    });
  });
});





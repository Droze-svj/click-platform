// Video Routes Tests

const request = require('supertest');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const jwt = require('jsonwebtoken');

describe('Video Routes', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Create test user
    testUser = new User({
      email: 'videotest@example.com',
      password: 'password123',
      name: 'Video Test User',
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
    await Content.deleteMany({ userId: testUser._id });
  });

  describe('GET /api/video', () => {
    it('should get user videos', async () => {
      const response = await request(app)
        .get('/api/video')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/video')
        .expect(401);
    });
  });

  describe('POST /api/video/upload', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/video/upload')
        .expect(401);
    });

    it('should require active subscription', async () => {
      // This test depends on subscription middleware
      // Mock or setup subscription for test user
    });
  });
});







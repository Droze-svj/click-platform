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
      emailVerified: true, // auth middleware 403s unverified users
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

    it('paginates with page/limit and returns a pagination envelope', async () => {
      // Seed 3 videos so a limit=2 page shows the cap + a correct total.
      const seeded = await Content.insertMany([
        { userId: testUser._id, title: 'v1', type: 'video', status: 'completed' },
        { userId: testUser._id, title: 'v2', type: 'video', status: 'completed' },
        { userId: testUser._id, title: 'v3', type: 'video', status: 'completed' },
      ]);
      try {
        const res = await request(app)
          .get('/api/video?page=1&limit=2')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(2); // limit honored
        expect(res.body.pagination).toMatchObject({ page: 1, limit: 2 });
        expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
        expect(res.body.pagination.pages).toBeGreaterThanOrEqual(2);
        // The list view must NOT ship the heavy blobs.
        expect(res.body.data[0]).not.toHaveProperty('editorState');
        expect(res.body.data[0]).not.toHaveProperty('transcript');
      } finally {
        await Content.deleteMany({ _id: { $in: seeded.map((s) => s._id) } });
      }
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







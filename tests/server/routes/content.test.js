// Content routes tests

const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');

describe('Content Routes', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/click-test');
    }
  });

  afterAll(async () => {
    await Content.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test user and get auth token
    testUser = new User({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });
    await testUser.save();

    authToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterEach(async () => {
    await Content.deleteMany({});
    await User.deleteMany({});
  });

  describe('GET /api/content', () => {
    it('should get user content list', async () => {
      // Create test content
      const content = new Content({
        userId: testUser._id,
        title: 'Test Content',
        type: 'video',
        status: 'completed',
      });
      await content.save();

      const response = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/content')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/content', () => {
    it('should create new content', async () => {
      const contentData = {
        title: 'New Content',
        type: 'video',
        description: 'Test description',
      };

      const response = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(contentData.title);
      expect(response.body.data.type).toBe(contentData.type);

      // Verify content was saved
      const content = await Content.findById(response.body.data._id);
      expect(content).toBeDefined();
      expect(content.userId.toString()).toBe(testUser._id.toString());
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/content')
        .send({ title: 'Test' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/content/:id', () => {
    it('should get content by ID', async () => {
      const content = new Content({
        userId: testUser._id,
        title: 'Test Content',
        type: 'video',
      });
      await content.save();

      const response = await request(app)
        .get(`/api/content/${content._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Content');
    });

    it('should not allow access to other user\'s content', async () => {
      // Create another user
      const otherUser = new User({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User',
      });
      await otherUser.save();

      // Create content for other user
      const content = new Content({
        userId: otherUser._id,
        title: 'Other User Content',
        type: 'video',
      });
      await content.save();

      const response = await request(app)
        .get(`/api/content/${content._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/content/:id', () => {
    it('should update content', async () => {
      const content = new Content({
        userId: testUser._id,
        title: 'Original Title',
        type: 'video',
      });
      await content.save();

      const response = await request(app)
        .put(`/api/content/${content._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');

      // Verify update in database
      const updated = await Content.findById(content._id);
      expect(updated.title).toBe('Updated Title');
    });
  });

  describe('DELETE /api/content/:id', () => {
    it('should delete content', async () => {
      const content = new Content({
        userId: testUser._id,
        title: 'To Delete',
        type: 'video',
      });
      await content.save();

      const response = await request(app)
        .delete(`/api/content/${content._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deleted = await Content.findById(content._id);
      expect(deleted).toBeNull();
    });
  });
});







// Content routes tests
//
// These exercise the REAL content API surface. The mongoose connection is owned
// by tests/setup.js (connect/close in its global hooks) — a per-suite connect or
// connection.close() caused the cross-file race where one file closed the shared
// connection and the next file's first query buffer-timed-out. We only manage
// our own data here.
//
// The previous fixtures targeted endpoints that don't exist in this shape:
//   - POST /api/content is async *generation* (enqueues a job, returns
//     { data: { contentId } }), not a synchronous CRUD create with a title —
//     it's covered by service/integration tests, not asserted here.
//   - There is no PUT /api/content/:id update route.
//   - Cross-user reads return 404 (not 403): the handler scopes by owner, so
//     another user's content is simply "not found" (no existence leak).

const request = require('supertest');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');

describe('Content Routes', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    testUser = new User({
      email: 'contenttest@example.com',
      password: 'password123',
      name: 'Test User',
      emailVerified: true, // auth middleware 403s unverified users
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
    it('should get the user content list', async () => {
      await new Content({
        userId: testUser._id,
        title: 'Test Content',
        type: 'video',
        status: 'completed',
      }).save();

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

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('GET /api/content/:contentId', () => {
    it('should get content by id for the owner', async () => {
      const content = await new Content({
        userId: testUser._id,
        title: 'Owned Content',
        type: 'video',
      }).save();

      const response = await request(app)
        .get(`/api/content/${content._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Owned Content');
    });

    it("should not leak another user's content (404)", async () => {
      const otherUser = await new User({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User',
        emailVerified: true,
      }).save();

      const content = await new Content({
        userId: otherUser._id,
        title: 'Other User Content',
        type: 'video',
      }).save();

      const response = await request(app)
        .get(`/api/content/${content._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBeFalsy();
    });

    it('should reject a malformed id with 400 (validateObjectId)', async () => {
      await request(app)
        .get('/api/content/not-a-valid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('DELETE /api/content/:contentId', () => {
    it("should delete the owner's content", async () => {
      const content = await new Content({
        userId: testUser._id,
        title: 'To Delete',
        type: 'video',
      }).save();

      const response = await request(app)
        .delete(`/api/content/${content._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      const deleted = await Content.findById(content._id);
      expect(deleted).toBeNull();
    });

    it('should require authentication', async () => {
      const content = await new Content({
        userId: testUser._id,
        title: 'Protected',
        type: 'video',
      }).save();

      await request(app)
        .delete(`/api/content/${content._id}`)
        .expect(401);
    });
  });
});

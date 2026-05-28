const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const schedulerRoutes = require('../../server/routes/scheduler');
const ScheduledPost = require('../../server/models/ScheduledPost');

const mockTestUserId = new mongoose.Types.ObjectId();
jest.mock("../../server/middleware/auth", () => (req, res, next) => { req.user = { _id: mockTestUserId }; next(); });
// Mock oauthService
jest.mock('../../server/services/oauthService', () => ({
  listSocialAccounts: jest.fn().mockResolvedValue([{ platformUserId: '123' }])
}));
// Mock auth middleware
const mockAuth = (req, res, next) => {
  req.user = { _id: mockTestUserId };
  next();
};

describe('Scheduler Integration Tests', () => {
  let mongoServer;
  let app;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    app = express();
    app.use(express.json());
    app.use('/api/scheduler', mockAuth, schedulerRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await ScheduledPost.deleteMany({});
    const Content = require('../../server/models/Content');
    await Content.deleteMany({});
  });

  describe('POST /api/scheduler/schedule', () => {
    it('should schedule a new post', async () => {
      const Content = require('../../server/models/Content');
      const testContent = await Content.create({
        userId: mockTestUserId,
        title: 'Test',
        status: 'completed',
        type: 'video'
      });

      const postData = {
        contentId: testContent._id.toString(),
        platform: 'twitter',
        scheduledTime: new Date(Date.now() + 3600000).toISOString(),
        content: 'Integration test post'
      };

      const res = await request(app)
        .post('/api/scheduler/schedule')
        .send(postData);

      if (res.statusCode !== 200) console.error("SCHEDULER 500:", res.body);
      expect(res.statusCode).toBe(200);
      expect(res.body.post.platform).toBe('twitter');
      
      const count = await ScheduledPost.countDocuments();
      expect(count).toBe(1);
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/scheduler/schedule')
        .send({ platform: 'twitter' }); // missing scheduledTime

      expect(res.statusCode).toBe(400);
    });
  });
});

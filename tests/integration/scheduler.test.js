const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const schedulerRoutes = require('../../server/routes/scheduler');
const ScheduledPost = require('../../server/models/ScheduledPost');

// Mock auth middleware
const mockAuth = (req, res, next) => {
  req.user = { _id: new mongoose.Types.ObjectId() };
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
  });

  describe('POST /api/scheduler/schedule', () => {
    it('should schedule a new post', async () => {
      const postData = {
        platform: 'twitter',
        scheduledTime: new Date(Date.now() + 3600000).toISOString(),
        content: 'Integration test post'
      };

      const res = await request(app)
        .post('/api/scheduler/schedule')
        .send(postData);

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

  describe('POST /api/scheduler/bulk-reschedule', () => {
    it('should reschedule multiple posts by shifting time', async () => {
      const userId = new mongoose.Types.ObjectId();
      // Manually set req.user._id in a more flexible mock if needed, 
      // but for now, we'll just use the one from mockAuth
      
      const p1 = await new ScheduledPost({
        userId: new mongoose.Types.ObjectId(), // This won't match mockAuth's user
        platform: 'twitter',
        scheduledTime: new Date(),
        status: 'scheduled'
      }).save();

      // We need to ensure the user ID matches the mockAuth user
      const testUser = new mongoose.Types.ObjectId();
      const localApp = express();
      localApp.use(express.json());
      localApp.use('/api/scheduler', (req, res, next) => {
        req.user = { _id: testUser };
        next();
      }, schedulerRoutes);

      const post = await new ScheduledPost({
        userId: testUser,
        platform: 'twitter',
        scheduledTime: new Date('2026-06-01T10:00:00Z'),
        status: 'scheduled'
      }).save();

      const oneHour = 3600000;
      const res = await request(localApp)
        .post('/api/scheduler/bulk-reschedule')
        .send({
          postIds: [post._id],
          timeShiftMs: oneHour
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.updated).toBe(1);

      const updatedPost = await ScheduledPost.findById(post._id);
      expect(updatedPost.scheduledTime.toISOString()).toBe('2026-06-01T11:00:00.000Z');
    });
  });
});

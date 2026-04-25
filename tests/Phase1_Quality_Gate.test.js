const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server/index'); // Assuming server/index exports app
const User = require('../server/models/User');
const storageService = require('../server/services/storageService');
const path = require('path');
const fs = require('fs');

describe('Phase 1 Quality Gate: Core Infrastructure Integration', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Connect to test database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click_test');
    }
    
    // Clean up test data
    await User.deleteMany({ email: 'test_quality@example.com' });
    
    // Create test user
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test_quality@example.com',
        password: 'Password123!',
        username: 'testquality'
      });
    
    testUser = response.body.user;
    authToken = response.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'test_quality@example.com' });
    await mongoose.connection.close();
  });

  test('1. Database Integration: User persistence and retrieval', async () => {
    const user = await User.findOne({ email: 'test_quality@example.com' });
    expect(user).toBeDefined();
    expect(user.username).toBe('testquality');
  });

  test('2. Storage Service: File upload and URL generation', async () => {
    const testFilePath = path.join(__dirname, 'fixtures/test-video.mp4');
    // Ensure fixture exists or create a tiny one
    if (!fs.existsSync(path.dirname(testFilePath))) fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
    if (!fs.existsSync(testFilePath)) fs.writeFileSync(testFilePath, 'fake video content');

    const result = await storageService.uploadFile(testFilePath, 'test/quality-gate-video.mp4');
    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
    
    // If not using cloud storage, it should be a local path
    if (!storageService.isCloudStorageEnabled()) {
      expect(result.url).toContain('/uploads/test/quality-gate-video.mp4');
    }

    // Clean up
    await storageService.deleteFile('test/quality-gate-video.mp4');
  });

  test('3. API Layer: Health endpoint and Auth protection', async () => {
    // 3a. Health check (should be public)
    const healthRes = await request(app).get('/api/status/health-pro');
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.body.status).toBe('up');

    // 3b. Protected route (should fail without token)
    const protectedRes = await request(app).get('/api/users/profile');
    expect(protectedRes.statusCode).toBe(401);

    // 3c. Protected route (should pass with token)
    const profileRes = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${authToken}`);
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.body.user.email).toBe('test_quality@example.com');
  });

  test('4. Prisma Integration Check', async () => {
    // Basic check to ensure Prisma client can be instantiated and used
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const usersCount = await prisma.user.count();
      expect(typeof usersCount).toBe('number');
    } finally {
      await prisma.$disconnect();
    }
  });
});

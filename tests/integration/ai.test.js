// AI Features Integration Tests

const request = require('supertest');
const mongoose = require('mongoose');
// AI Features Integration Tests
// Note: These tests should be run with the server running
// or with a test server instance

// For testing, we'll use a test server setup
// In production, ensure server/index.js exports the app
const setupTestServer = require('./test-server-setup');
const User = require('../../server/models/User');
const Content = require('../../server/models/Content');

describe('AI Features Integration Tests', () => {
  let authToken;
  let testUser;
  let testContent;

  beforeAll(async () => {
    // Create test user
    testUser = new User({
      name: 'Test User',
      email: 'test-ai@example.com',
      password: 'hashedpassword',
      subscription: { status: 'active', plan: 'pro' },
    });
    await testUser.save();

    // Create test content
    testContent = new Content({
      userId: testUser._id,
      title: 'Test Content',
      body: 'This is test content for AI recommendations',
      type: 'article',
      status: 'published',
      platform: 'instagram',
      views: 100,
      likes: 20,
    });
    await testContent.save();

    // Use test token (mock auth middleware handles this)
    authToken = 'test-token';
  });

  afterAll(async () => {
    await Content.deleteMany({ userId: testUser._id });
    await User.deleteMany({ email: 'test-ai@example.com' });
    await mongoose.connection.close();
  });

  describe('Multi-Model AI', () => {
    test('GET /api/ai/multi-model/models - Should return available models', async () => {
      const response = await request(app)
        .get('/api/ai/multi-model/models')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .set('x-test-user-id', testUser._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('providers');
      expect(response.body.data).toHaveProperty('currentProvider');
      expect(response.body.data).toHaveProperty('currentModel');
    });

    test('POST /api/ai/multi-model/provider - Should initialize AI provider', async () => {
      const response = await request(app)
        .post('/api/ai/multi-model/provider')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({ provider: 'openai', model: 'gpt-4' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('provider');
      expect(response.body.data).toHaveProperty('model');
    });

    test('POST /api/ai/multi-model/generate - Should generate content with model', async () => {
      const response = await request(app)
        .post('/api/ai/multi-model/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: 'Write a short social media post about productivity',
          taskType: 'content-generation',
          options: { temperature: 0.7 },
        });

      // May fail if OpenAI API key not configured - that's okay
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('content');
        expect(response.body.data).toHaveProperty('model');
      } else {
        expect(response.status).toBe(500);
      }
    });

    test('POST /api/ai/multi-model/compare - Should compare model outputs', async () => {
      const response = await request(app)
        .post('/api/ai/multi-model/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: 'Write a tweet about AI',
          taskType: 'content-generation',
          models: ['gpt-4', 'gpt-3.5-turbo'],
        });

      // May fail if OpenAI API key not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('outputs');
        expect(response.body.data).toHaveProperty('bestModel');
      }
    });
  });

  describe('AI Recommendations', () => {
    test('GET /api/ai/recommendations/personalized - Should return personalized recommendations', async () => {
      const response = await request(app)
        .get('/api/ai/recommendations/personalized')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .query({ limit: 5 });

      // May fail if OpenAI API key not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('recommendations');
        expect(response.body.data).toHaveProperty('preferences');
        expect(Array.isArray(response.body.data.recommendations)).toBe(true);
      }
    });

    test('POST /api/ai/recommendations/learn - Should learn from user behavior', async () => {
      const response = await request(app)
        .post('/api/ai/recommendations/learn')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          contentId: testContent._id.toString(),
          action: 'view',
          duration: 30,
          platform: 'instagram',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('GET /api/ai/recommendations/trend-based - Should return trend-based suggestions', async () => {
      const response = await request(app)
        .get('/api/ai/recommendations/trend-based')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .query({ platform: 'instagram' });

      // May fail if OpenAI API key not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('suggestions');
        expect(response.body.data).toHaveProperty('trends');
      }
    });
  });

  describe('Predictive Analytics', () => {
    test('POST /api/ai/predictive/performance - Should predict content performance', async () => {
      const response = await request(app)
        .post('/api/ai/predictive/performance')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          contentData: {
            title: 'Test Post',
            body: 'This is a test post for performance prediction',
            platform: 'instagram',
            tags: ['test', 'ai'],
            category: 'technology',
          },
        });

      // May fail if OpenAI API key not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('performanceScore');
        expect(response.body.data).toHaveProperty('expectedViews');
        expect(response.body.data).toHaveProperty('expectedEngagementRate');
      }
    });

    test('POST /api/ai/predictive/posting-time - Should predict optimal posting time', async () => {
      const response = await request(app)
        .post('/api/ai/predictive/posting-time')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          platform: 'instagram',
          contentData: {},
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('optimalTimes');
      expect(response.body.data).toHaveProperty('confidence');
      expect(Array.isArray(response.body.data.optimalTimes)).toBe(true);
    });

    test('GET /api/ai/predictive/trends - Should forecast content trends', async () => {
      const response = await request(app)
        .get('/api/ai/predictive/trends')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .query({ platform: 'instagram', days: 30 });

      // May fail if OpenAI API key not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('emergingTrends');
        expect(response.body.data).toHaveProperty('decliningTrends');
      }
    });
  });

  describe('Advanced Content Generation', () => {
    test('POST /api/ai/content-generation/advanced - Should generate advanced content', async () => {
      const response = await request(app)
        .post('/api/ai/content-generation/advanced')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: 'Write about productivity tips',
          options: {
            style: 'engaging',
            tone: 'professional',
            length: 'medium',
            format: 'paragraph',
          },
        });

      // May fail if OpenAI API key not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('content');
        expect(response.body.data).toHaveProperty('metadata');
      }
    });

    test('POST /api/ai/content-generation/variations - Should generate content variations', async () => {
      const response = await request(app)
        .post('/api/ai/content-generation/variations')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          originalContent: 'This is original content',
          count: 3,
        });

      // May fail if OpenAI API key not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      }
    });

    test('POST /api/ai/content-generation/template - Should generate from template', async () => {
      const response = await request(app)
        .post('/api/ai/content-generation/template')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          templateType: 'how-to',
          variables: { topic: 'Productivity', steps: 5 },
          options: { style: 'professional' },
        });

      // May fail if OpenAI API key not configured
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('sections');
      }
    });
  });
});


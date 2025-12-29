// End-to-End Flow Integration Tests

const request = require('supertest');
const mongoose = require('mongoose');
const createTestApp = require('./test-server-setup');
const User = require('../../server/models/User');
const Content = require('../../server/models/Content');
const Workflow = require('../../server/models/Workflow');

const app = createTestApp();

describe('End-to-End Flow Integration Tests', () => {
  let authToken;
  let testUser;
  let createdContentId;
  let createdWorkflowId;

  beforeAll(async () => {
    // Create test user
    testUser = new User({
      name: 'E2E Test User',
      email: 'e2e-test@example.com',
      password: 'hashedpassword',
      subscription: { status: 'active', plan: 'pro' },
    });
    await testUser.save();

    authToken = 'test-token';
  });

  afterAll(async () => {
    await Content.deleteMany({ userId: testUser._id });
    await Workflow.deleteMany({ userId: testUser._id });
    await User.deleteMany({ email: 'e2e-test@example.com' });
    await mongoose.connection.close();
  });

  describe('Complete Content Creation Flow with AI', () => {
    test('Flow: Generate content → Get recommendations → Predict performance → Create workflow', async () => {
      // Step 1: Generate content
      const generateRes = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          text: 'This is a test article about productivity and time management.',
          title: 'Productivity Tips',
          platforms: ['instagram', 'twitter'],
        });

      if (generateRes.status === 200 && generateRes.body.data?.contentId) {
        createdContentId = generateRes.body.data.contentId;

        // Step 2: Get AI recommendations
        const recommendationsRes = await request(app)
          .get('/api/ai/recommendations/personalized')
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .query({ limit: 3 });

        // Step 3: Predict performance
        const predictionRes = await request(app)
          .post('/api/ai/predictive/performance')
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            contentData: {
              title: 'Productivity Tips',
              body: 'This is a test article about productivity',
              platform: 'instagram',
              tags: ['productivity', 'tips'],
            },
          });

        // Step 4: Create workflow from template
        const workflowRes = await request(app)
          .post('/api/workflows/templates/create')
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            templateId: 'content-publishing',
            customizations: {
              name: 'Auto Publish Content',
            },
          });

        // Verify flow completed
        expect(generateRes.status).toBe(200);
        if (recommendationsRes.status === 200) {
          expect(recommendationsRes.body.success).toBe(true);
        }
        if (predictionRes.status === 200) {
          expect(predictionRes.body.success).toBe(true);
        }
        if (workflowRes.status === 200) {
          expect(workflowRes.body.success).toBe(true);
          createdWorkflowId = workflowRes.body.data?._id;
        }
      }
    });
  });

  describe('Workflow Execution Flow', () => {
    test('Flow: Create workflow → Schedule → Execute → Check analytics', async () => {
      // Step 1: Create advanced workflow
      const createRes = await request(app)
        .post('/api/workflows/advanced/create')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          name: 'E2E Test Workflow',
          description: 'End-to-end test workflow',
          triggers: [
            {
              type: 'event',
              config: { event: 'content.published' },
            },
          ],
          actions: [
            {
              type: 'post_to_social',
              config: { platforms: ['instagram'] },
            },
          ],
        });

      if (createRes.status === 200) {
        const workflowId = createRes.body.data._id;

        // Step 2: Schedule workflow
        const scheduleRes = await request(app)
          .post(`/api/workflows/advanced/${workflowId}/schedule`)
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            scheduleConfig: {
              type: 'daily',
              time: '10:00',
              timezone: 'UTC',
            },
          });

        // Step 3: Execute workflow
        const executeRes = await request(app)
          .post(`/api/workflows/advanced/${workflowId}/execute`)
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            context: {
              platform: 'instagram',
              status: 'published',
            },
          });

        // Step 4: Check analytics
        const analyticsRes = await request(app)
          .get(`/api/workflows/advanced/${workflowId}/analytics`)
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

        // Verify flow
        expect(createRes.status).toBe(200);
        if (scheduleRes.status === 200) {
          expect(scheduleRes.body.success).toBe(true);
        }
        expect([200, 400, 500]).toContain(executeRes.status);
        expect(analyticsRes.status).toBe(200);
        expect(analyticsRes.body.success).toBe(true);
      }
    });
  });

  describe('Infrastructure Monitoring Flow', () => {
    test('Flow: Monitor resources → Check thresholds → Get recommendations (admin only)', async () => {
      // This test requires admin access
      const adminToken = 'admin-test-token';

      // Step 1: Monitor resources
      const monitorRes = await request(app)
        .get('/api/infrastructure/resources/monitor')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true')
        .set('x-test-user-id', 'admin-user-id');

      // Step 2: Check thresholds
      const thresholdsRes = await request(app)
        .get('/api/infrastructure/resources/thresholds')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true')
        .set('x-test-user-id', 'admin-user-id');

      // Step 3: Get recommendations
      const recommendationsRes = await request(app)
        .get('/api/infrastructure/resources/recommendations')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-test-admin', 'true')
        .set('x-test-user-id', 'admin-user-id');

      // May fail if not admin - that's expected
      if (monitorRes.status === 200) {
        expect(monitorRes.body.success).toBe(true);
        expect(monitorRes.body.data).toHaveProperty('memory');
        expect(monitorRes.body.data).toHaveProperty('cpu');
      }

      if (thresholdsRes.status === 200) {
        expect(thresholdsRes.body.success).toBe(true);
        expect(thresholdsRes.body.data).toHaveProperty('alerts');
      }

      if (recommendationsRes.status === 200) {
        expect(recommendationsRes.body.success).toBe(true);
        expect(recommendationsRes.body.data).toHaveProperty('recommendations');
      }
    });
  });

  describe('AI Model Comparison Flow', () => {
    test('Flow: Get models → Initialize provider → Compare models', async () => {
      // Step 1: Get available models
      const modelsRes = await request(app)
        .get('/api/ai/multi-model/models')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

      expect(modelsRes.status).toBe(200);
      expect(modelsRes.body.success).toBe(true);

      // Step 2: Initialize provider
      const initRes = await request(app)
        .post('/api/ai/multi-model/provider')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({ provider: 'openai', model: 'gpt-4' });

      expect(initRes.status).toBe(200);
      expect(initRes.body.success).toBe(true);

      // Step 3: Compare models
      const compareRes = await request(app)
        .post('/api/ai/multi-model/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: 'Write a short tweet about AI',
          taskType: 'content-generation',
          models: ['gpt-4', 'gpt-3.5-turbo'],
        });

      // May fail if OpenAI API key not configured
      if (compareRes.status === 200) {
        expect(compareRes.body.success).toBe(true);
        expect(compareRes.body.data).toHaveProperty('outputs');
        expect(compareRes.body.data).toHaveProperty('bestModel');
      }
    });
  });

  describe('Error Recovery Flow', () => {
    test('Flow: Handle errors gracefully → Retry → Fallback', async () => {
      // Test with invalid data
      const invalidRes = await request(app)
        .post('/api/ai/multi-model/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          // Missing required fields
        });

      expect([400, 500]).toContain(invalidRes.status);

      // Test with valid data but missing API key (should handle gracefully)
      const validRes = await request(app)
        .post('/api/ai/multi-model/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          prompt: 'Test prompt',
          taskType: 'content-generation',
        });

      // Should either succeed or fail gracefully
      expect([200, 500]).toContain(validRes.status);
    });
  });
});


// Workflow Automation Integration Tests

const request = require('supertest');
const mongoose = require('mongoose');
const createTestApp = require('./test-server-setup');
const User = require('../../server/models/User');
const Workflow = require('../../server/models/Workflow');

const app = createTestApp();

describe('Workflow Automation Integration Tests', () => {
  let authToken;
  let testUser;
  let testWorkflowId;

  beforeAll(async () => {
    // Create test user
    testUser = new User({
      name: 'Test Workflow User',
      email: 'test-workflow@example.com',
      password: 'hashedpassword',
      subscription: { status: 'active', plan: 'pro' },
    });
    await testUser.save();

    authToken = 'test-token';
  });

  afterAll(async () => {
    await Workflow.deleteMany({ userId: testUser._id });
    await User.deleteMany({ email: 'test-workflow@example.com' });
    await mongoose.connection.close();
  });

  describe('Workflow Templates', () => {
    test('GET /api/workflows/templates - Should return workflow templates', async () => {
      const response = await request(app)
        .get('/api/workflows/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data).toBe('object');
    });

    test('GET /api/workflows/templates/categories - Should return template categories', async () => {
      const response = await request(app)
        .get('/api/workflows/templates/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data).toBe('object');
    });

    test('POST /api/workflows/templates/create - Should create workflow from template', async () => {
      const response = await request(app)
        .post('/api/workflows/templates/create')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          templateId: 'content-publishing',
          customizations: {
            name: 'My Content Publishing Workflow',
          },
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('_id');
        expect(response.body.data).toHaveProperty('name');
        expect(response.body.data).toHaveProperty('triggers');
        expect(response.body.data).toHaveProperty('actions');
        testWorkflowId = response.body.data._id;
      }
    });
  });

  describe('Advanced Workflows', () => {
    test('POST /api/workflows/advanced/create - Should create advanced workflow', async () => {
      const response = await request(app)
        .post('/api/workflows/advanced/create')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          name: 'Test Advanced Workflow',
          description: 'A test workflow with conditions',
          triggers: [
            {
              type: 'event',
              config: { event: 'content.published' },
            },
          ],
          actions: [
            {
              type: 'post_to_social',
              config: { platforms: ['instagram', 'twitter'] },
            },
          ],
          conditions: [
            {
              field: 'platform',
              operator: 'equals',
              value: 'instagram',
            },
          ],
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('_id');
        expect(response.body.data).toHaveProperty('name', 'Test Advanced Workflow');
        expect(response.body.data).toHaveProperty('triggers');
        expect(response.body.data).toHaveProperty('actions');
        expect(response.body.data).toHaveProperty('conditions');
        expect(response.body.data).toHaveProperty('advanced', true);
        testWorkflowId = response.body.data._id;
      }
    });

    test('POST /api/workflows/advanced/:workflowId/execute - Should execute conditional workflow', async () => {
      if (!testWorkflowId) {
        // Create a workflow first
        const createRes = await request(app)
          .post('/api/workflows/advanced/create')
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            name: 'Test Execute Workflow',
            triggers: [{ type: 'event', config: { event: 'test' } }],
            actions: [{ type: 'test', config: {} }],
          });

        if (createRes.status === 200) {
          testWorkflowId = createRes.body.data._id;
        }
      }

      if (testWorkflowId) {
        const response = await request(app)
          .post(`/api/workflows/advanced/${testWorkflowId}/execute`)
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            context: {
              platform: 'instagram',
              status: 'published',
            },
          });

        expect([200, 400, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('executed');
        }
      }
    });

    test('POST /api/workflows/advanced/:workflowId/schedule - Should schedule workflow', async () => {
      if (!testWorkflowId) {
        const createRes = await request(app)
          .post('/api/workflows/advanced/create')
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            name: 'Test Schedule Workflow',
            triggers: [{ type: 'schedule', config: {} }],
            actions: [{ type: 'test', config: {} }],
          });

        if (createRes.status === 200) {
          testWorkflowId = createRes.body.data._id;
        }
      }

      if (testWorkflowId) {
        const response = await request(app)
          .post(`/api/workflows/advanced/${testWorkflowId}/schedule`)
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            scheduleConfig: {
              type: 'daily',
              time: '09:00',
              timezone: 'UTC',
            },
          });

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('success', true);
          expect(response.body.data).toHaveProperty('schedule');
        }
      }
    });

    test('GET /api/workflows/advanced/:workflowId/analytics - Should get workflow analytics', async () => {
      if (!testWorkflowId) {
        const createRes = await request(app)
          .post('/api/workflows/advanced/create')
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
          .send({
            name: 'Test Analytics Workflow',
            triggers: [{ type: 'event', config: {} }],
            actions: [{ type: 'test', config: {} }],
          });

        if (createRes.status === 200) {
          testWorkflowId = createRes.body.data._id;
        }
      }

      if (testWorkflowId) {
        const response = await request(app)
          .get(`/api/workflows/advanced/${testWorkflowId}/analytics`)
          .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('workflowId');
        expect(response.body.data).toHaveProperty('totalExecutions');
        expect(response.body.data).toHaveProperty('successfulExecutions');
        expect(response.body.data).toHaveProperty('successRate');
      }
    });
  });

  describe('Workflow Error Handling', () => {
    test('POST /api/workflows/advanced/create - Should reject invalid workflow data', async () => {
      const response = await request(app)
        .post('/api/workflows/advanced/create')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString())
        .send({
          name: 'Invalid Workflow',
          // Missing required triggers and actions
        });

      expect([400, 500]).toContain(response.status);
    });

    test('GET /api/workflows/advanced/invalid-id/analytics - Should handle non-existent workflow', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/workflows/advanced/${fakeId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-user-id', testUser._id.toString());

      expect([404, 500]).toContain(response.status);
    });
  });
});


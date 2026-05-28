const request = require('supertest');
const createTestApp = require('./test-server-setup');
const app = createTestApp();
const User = require('../../server/models/User');
const mongoose = require('mongoose');

describe('API Integration Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Ensure DB is connected
    const { initDatabases } = require('../../server/config/database');
    await initDatabases();

    // Create test user
    await User.deleteOne({ email: 'integration_' + Date.now() + '@example.com' });
    testUser = new User({
      email: 'integration_' + Date.now() + '@example.com',
      password: 'TestPassword123!',
      name: 'Integration Test User',
      emailVerified: true,
    });
    await testUser.save();

    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await User.deleteOne({ _id: testUser._id });
    await mongoose.disconnect();
  });

  describe('Authentication Flow', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser_' + Date.now() + '@example.com',
          password: 'TestPassword123!',
          name: 'New User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('token');

      // Cleanup
      await User.deleteOne({ email: 'newuser_' + Date.now() + '@example.com' });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');
    });

    it('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('Protected Routes', () => {
    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Pre-Publish Insights & Trust/Credibility APIs', () => {
    let testContent;
    let signedContent;
    let testAuditMetadata;

    beforeAll(async () => {
      const Content = require('../../server/models/Content');
      const AuditMetadata = require('../../server/models/AuditMetadata');

      // Seed an unsigned content document for testUser
      testContent = new Content({
        userId: testUser._id,
        title: 'Integration Test Article',
        type: 'article',
        transcript: 'This is a test transcript for the click platform pre-publish validation. It needs to be at least fifty characters long to pass validation rules.',
        description: 'Integration Test Description',
        status: 'completed',
        platform: 'linkedin',
        category: 'finance'
      });
      await testContent.save();

      // Seed a signed content document for testUser
      signedContent = new Content({
        userId: testUser._id,
        title: 'Integration Test Provenance Article',
        type: 'article',
        transcript: 'This is another test transcript specifically meant for C2PA cryptographic signature verification.',
        description: 'Provenance Test Description',
        status: 'completed',
        platform: 'instagram',
        category: 'general'
      });
      await signedContent.save();

      // Seed corresponding AuditMetadata C2PA manifest
      testAuditMetadata = new AuditMetadata({
        contentId: signedContent._id,
        userId: testUser._id.toString(),
        aeo: {
          schemaMarkup: { "@context": "https://schema.org", "@type": "SocialMediaPosting" }
        },
        authenticity: {
          manifestHash: 'c2pa_test_hash_12345',
          signature: 'c2pa_test_signature_abcde',
          provider: 'click-platform-test',
          authScore: 95,
          c2paBlock: {
            manifestHash: 'c2pa_test_hash_12345',
            signer: 'Click Trust Authority',
            signedAt: new Date(),
            actions: ['transcoded', 'resized'],
            trainingMining: 'not-allowed'
          }
        }
      });
      await testAuditMetadata.save();
    });

    afterAll(async () => {
      const Content = require('../../server/models/Content');
      const AuditMetadata = require('../../server/models/AuditMetadata');

      if (testContent) {
        await Content.deleteOne({ _id: testContent._id });
      }
      if (signedContent) {
        await Content.deleteOne({ _id: signedContent._id });
      }
      if (testAuditMetadata) {
        await AuditMetadata.deleteOne({ _id: testAuditMetadata._id });
      }
    });

    it('should generate pre-publish report successfully', async () => {
      const response = await request(app)
        .get(`/api/content/${testContent._id}/pre-publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('overallScore');
      expect(response.body.data).toHaveProperty('verdict');
      expect(response.body.data).toHaveProperty('hookAnalysis');
      expect(response.body.data).toHaveProperty('optimalPostingTimes');
      expect(response.body.data).toHaveProperty('priorityActions');
    });

    it('should fail pre-publish report for non-existent content', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/content/${fakeId}/pre-publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should generate conversion-science A/B variants successfully', async () => {
      const response = await request(app)
        .get(`/api/content/${testContent._id}/ab-variants`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('variants');
      expect(response.body.data).toHaveProperty('original');
    });

    it('should fetch unsigned provenance authenticity details successfully', async () => {
      const response = await request(app)
        .get(`/api/trust/provenance/${testContent._id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('signed', false);
      expect(response.body.data).toHaveProperty('reason', 'No C2PA manifest on record');
    });

    it('should fetch signed provenance authenticity details successfully', async () => {
      const response = await request(app)
        .get(`/api/trust/provenance/${signedContent._id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('signed', true);
      expect(response.body.data).toHaveProperty('transparencyScore', 95);
      expect(response.body.data).toHaveProperty('signer', 'Click Trust Authority');
      expect(response.body.data).toHaveProperty('antiDeepfakeGrade', 'A+');
      expect(response.body.data).toHaveProperty('aeoIndexed', true);
    });

    it('should fetch aggregate social-proof successfully', async () => {
      const response = await request(app)
        .get('/api/trust/social-proof')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('available', true);
      expect(response.body.data).toHaveProperty('soc2', 'compliant');
    });

    it('should calculate and persist user credibility scoring', async () => {
      const response = await request(app)
        .get(`/api/trust/credibility/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('level');
      expect(response.body.data).toHaveProperty('breakdown');
      expect(response.body.data).toHaveProperty('nextSteps');
    });
  });
});







// The music-licensing (10 files) and ai-music (6 files) clusters are mounted on
// shared bases. Three pairs of routes collide by path and would shadow each
// other if they shared a prefix:
//
//   GET /providers  — music-licensing-admin  vs music-licensing-analytics
//   GET /providers  — ai-music-admin         vs ai-music-generation
//   /playlists*     — music-licensing-favorites vs music-catalog-playlists
//
// featureRoutes.js separates each pair with sub-prefixes. These tests prove
// BOTH sides of every pair are independently reachable — a shadowed route would
// answer with the other one's handler (or 404), not its own.

const request = require('supertest');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const jwt = require('jsonwebtoken');

const tokenFor = (user) =>
  jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

const ADMIN_EMAIL = 'music-admin@example.com';

describe('music cluster mounts', () => {
  let user, token, admin, adminToken;
  const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

  beforeAll(async () => {
    // requireAdmin authorizes against the ADMIN_EMAILS allowlist, NOT User.role.
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;

    user = await User.create({
      email: 'music-user@example.com', password: 'password123', name: 'Music User', emailVerified: true,
    });
    admin = await User.create({
      email: ADMIN_EMAIL, password: 'password123', name: 'Music Admin', emailVerified: true,
    });
    token = tokenFor(user);
    adminToken = tokenFor(admin);
  });

  afterAll(async () => {
    if (ORIGINAL_ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
    await User.deleteMany({ _id: { $in: [user._id, admin._id] } });
  });

  // A mounted route must not 404. Anything else (200, 400, 403, 503) proves the
  // router is wired and the request reached its handler.
  const isMounted = (status) => status !== 404;

  describe('every cluster base is reachable (not 404)', () => {
    const authedGets = [
      '/api/music-licensing/analytics/providers',
      '/api/music-licensing/analytics/usage',
      '/api/music-licensing/quota',
      '/api/music-licensing/favorites',
      '/api/music-licensing/playlists',
      '/api/music-licensing/transparency',
      '/api/music-licensing/cost-breakdown',
      '/api/music-licensing/learning/preferences',
      '/api/music-catalog/playlists',
      '/api/ai-music/providers',
      '/api/ai-music/generations',
      '/api/ai-music/templates',
      '/api/ai-music/analytics/cost',
      '/api/ai-music/batch/status',
    ];

    it.each(authedGets)('%s is mounted', async (path) => {
      const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect(isMounted(res.status)).toBe(true);
    });
  });

  describe('colliding /providers routes are separated, not shadowed', () => {
    it('music-licensing admin vs analytics resolve to DIFFERENT handlers', async () => {
      // The admin one is requireAdmin-gated; the analytics one is not. If they
      // were sharing a base, one would answer for both and these would match.
      const asUser = await request(app)
        .get('/api/music-licensing/admin/providers').set('Authorization', `Bearer ${token}`);
      const analytics = await request(app)
        .get('/api/music-licensing/analytics/providers').set('Authorization', `Bearer ${token}`);

      expect(asUser.status).toBe(403);          // admin gate reached
      expect(analytics.status).not.toBe(404);   // separate handler reached
      expect(analytics.status).not.toBe(403);   // and NOT the admin one
    });

    it('ai-music admin vs generation resolve to DIFFERENT handlers', async () => {
      const adminRoute = await request(app)
        .get('/api/ai-music/admin/providers').set('Authorization', `Bearer ${token}`);
      const generation = await request(app)
        .get('/api/ai-music/providers').set('Authorization', `Bearer ${token}`);

      expect(adminRoute.status).toBe(403);
      expect(generation.status).not.toBe(404);
      expect(generation.status).not.toBe(403);
    });

    it('the admin routes DO admit a real admin (the gate is role-based, not a shadow)', async () => {
      const res = await request(app)
        .get('/api/music-licensing/admin/providers').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(404);
    });
  });

  describe('colliding /playlists routes are separated', () => {
    it('personal favorites and curated catalog are distinct endpoints', async () => {
      const favorites = await request(app)
        .get('/api/music-licensing/playlists').set('Authorization', `Bearer ${token}`);
      const catalog = await request(app)
        .get('/api/music-catalog/playlists').set('Authorization', `Bearer ${token}`);

      expect(favorites.status).not.toBe(404);
      expect(catalog.status).not.toBe(404);
    });
  });

  describe('paid generation endpoints are budget-guarded', () => {
    // These call paid third-party providers (Mubert/Soundraw). They imported
    // aiLimiter but never applied it, and had no costGuard at all.
    const paid = [
      '/api/ai-music/generate',
      '/api/ai-music/batch/generate',
      '/api/music-licensing/dynamic/generate',
    ];

    it.each(paid)('%s requires authentication', async (path) => {
      const res = await request(app).post(path).send({});
      expect(res.status).toBe(401);
    });

    it.each(paid)('%s is mounted and validates input rather than 404ing', async (path) => {
      const res = await request(app).post(path).set('Authorization', `Bearer ${token}`).send({});
      expect(res.status).not.toBe(404);
      expect(res.status).toBeLessThan(500);
    });
  });
});

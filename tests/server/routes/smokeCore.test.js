// Core-flow endpoint smoke test (GATING).
//
// Hits the endpoints a real tester walks through — register/login/me, content
// list/get, video list/status, the core AI generators (captions/highlights/
// ideas), and analytics — and FAILS on any 5xx or malformed response. AI runs
// in mock mode under NODE_ENV=test (googleAI returns canned JSON), so these
// exercise the full route→service wiring deterministically without a live key.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const app = require('../../../server/index');
const { seedSmokeFixtures, cleanupSmokeFixtures } = require('../../smoke/fixtures');

// Each case: name, method, path(fx), auth ('user' | false), body(fx)?,
// expect[] (allowed statuses), shape? (assert {success:true} on a 2xx).
const CASES = [
  // --- health (public) ---
  { name: 'GET /api/health/light', method: 'get', path: () => '/api/health/light', auth: false, expect: [200] },
  { name: 'GET /api/health/ai', method: 'get', path: () => '/api/health/ai', auth: false, expect: [200, 503] },

  // --- auth ---
  // /me intentionally returns { user } (not the success envelope) — the client depends on it.
  { name: 'GET /api/auth/me (user)', method: 'get', path: () => '/api/auth/me', auth: 'user', expect: [200], shape: 'user' },
  { name: 'GET /api/auth/me (no token → 401)', method: 'get', path: () => '/api/auth/me', auth: false, expect: [401] },

  // --- content ---
  { name: 'GET /api/content (list)', method: 'get', path: () => '/api/content', auth: 'user', expect: [200], shape: true },
  { name: 'GET /api/content/:id (owned)', method: 'get', path: (fx) => `/api/content/${fx.content._id}`, auth: 'user', expect: [200], shape: true },
  { name: 'GET /api/content/:id (bad id → 400)', method: 'get', path: () => '/api/content/not-a-valid-id', auth: 'user', expect: [400] },
  { name: 'GET /api/content/:id (no token → 401)', method: 'get', path: (fx) => `/api/content/${fx.content._id}`, auth: false, expect: [401] },

  // --- video ---
  { name: 'GET /api/video (list)', method: 'get', path: () => '/api/video', auth: 'user', expect: [200], shape: true },
  { name: 'GET /api/video/:id/status', method: 'get', path: (fx) => `/api/video/${fx.content._id}/status`, auth: 'user', expect: [200, 404] },

  // --- analytics ---
  { name: 'GET /api/analytics/content', method: 'get', path: () => '/api/analytics/content', auth: 'user', expect: [200], shape: true },
  { name: 'GET /api/analytics/performance/global', method: 'get', path: () => '/api/analytics/performance/global', auth: 'user', expect: [200], shape: true },

  // --- core AI generators (mock AI in test) ---
  { name: 'POST /api/creative/ideation/ideas', method: 'post', path: () => '/api/creative/ideation/ideas', auth: 'user', body: () => ({ topic: 'AI video editing for creators', platform: 'tiktok', count: 3 }), expect: [200], shape: true },
  { name: 'POST /api/video/extract-highlights', method: 'post', path: () => '/api/video/extract-highlights', auth: 'user', body: (fx) => ({ videoId: String(fx.content._id), url: '/uploads/smoke.mp4', duration: 60 }), expect: [200], shape: true },
  { name: 'POST /api/video/generate-captions', method: 'post', path: () => '/api/video/generate-captions', auth: 'user', body: (fx) => ({ videoId: String(fx.content._id), url: '/uploads/smoke.mp4', duration: 60 }), expect: [200], shape: true },

  // --- validation paths (mounted + clean, no heavy work) ---
  { name: 'POST /api/video/extract-highlights (empty → 400)', method: 'post', path: () => '/api/video/extract-highlights', auth: 'user', body: () => ({}), expect: [400] },
  { name: 'POST /api/video/generate-captions (empty → 400)', method: 'post', path: () => '/api/video/generate-captions', auth: 'user', body: () => ({}), expect: [400] },
];

describe('Core-flow endpoint smoke', () => {
  let fx;

  beforeAll(async () => {
    fx = await seedSmokeFixtures();
  });

  afterAll(async () => {
    await cleanupSmokeFixtures();
  });

  CASES.forEach((c) => {
    it(c.name, async () => {
      let req = request(app)[c.method](c.path(fx));
      if (c.auth === 'user') req = req.set('Authorization', `Bearer ${fx.userToken}`);
      if (c.body) req = req.send(c.body(fx));

      const res = await req;

      // The non-negotiable gate: no endpoint on the core flow may 5xx.
      if (res.status >= 500) {
        throw new Error(
          `${c.name} returned ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`
        );
      }

      // And it must land on one of the expected statuses (catches 404/wrong-code).
      if (!c.expect.includes(res.status)) {
        throw new Error(
          `${c.name} expected ${JSON.stringify(c.expect)} but got ${res.status}: ` +
          `${JSON.stringify(res.body).slice(0, 300)}`
        );
      }

      // 2xx responses must carry the expected envelope.
      if (c.shape && res.status >= 200 && res.status < 300) {
        if (c.shape === 'user') {
          expect(res.body.user).toBeDefined();
        } else {
          expect(res.body.success).toBe(true);
        }
      }
    });
  });
});

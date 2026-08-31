// Guards the "static route swallowed by an earlier /:param route" bug class.
//
// Express matches layers in registration order, so a `/:id` route registered
// before a sibling static path wins for BOTH. `GET /api/export/history` landed
// in `GET /api/export/:jobId` as jobId="history", and the real history handler
// further down the file was unreachable. The failure is invisible from the
// outside: the wrong handler answers with a plausible 404 or an empty payload,
// never a 5xx, so the endpoint sweeps pass while the feature is dead.
//
// The 2026-08 audit found 23 of these. Twelve were single-file ordering and were
// fixed by moving the param route below its static siblings. The rest were
// CROSS-ROUTER — several routers share one mount prefix (five share
// /api/approvals) and the first router's `/:id` route consumed static paths
// belonging to later ones. Those are fixed with objectIdOrSkip, which declines a
// segment that is not an ObjectId so matching continues down the chain.
//
// Two tests, because neither alone is sufficient:
//   1. Order — catches a newly added `/:id` placed above a static sibling.
//   2. Reachability — proves the guarded routes actually resolve to their own
//      handler, which no amount of path-order analysis can show.

const request = require('supertest');
const app = require('../../server/index');
const User = require('../../server/models/User');
const jwt = require('jsonwebtoken');
const { walkRoutes } = require('../smoke/walkRoutes');

// Static paths that ARE shadowed by registration order but are reachable anyway,
// because the shadowing `/:param` route carries objectIdOrSkip. Test 2 proves it.
const GUARDED = new Set([
  'POST /api/approvals/bulk/approve',
  'POST /api/approvals/bulk/reject',
  'POST /api/approvals/bulk/request-changes',
  'GET /api/approvals/dashboard',
  'GET /api/approvals/delegations',
  'GET /api/approvals/sla-alerts',
  'GET /api/reports/scheduled',
  'GET /api/ai/templates/suggestions',
]);

function findShadowed(routes) {
  const byMethod = {};
  routes.forEach((r, i) => { (byMethod[r.method] ||= []).push({ ...r, i }); });

  const out = [];
  for (const method of Object.keys(byMethod)) {
    const list = byMethod[method];
    for (const early of list) {
      for (const late of list) {
        if (early.i >= late.i) continue;
        // A path ending in '/' is a router root, not a shadowed sibling.
        if (late.path.endsWith('/')) continue;

        const A = early.path.split('/');
        const B = late.path.split('/');
        if (A.length !== B.length) continue;
        // `late` is fully static and `early` matches it via at least one param.
        if (B.some((seg) => seg.startsWith(':'))) continue;

        let hasParam = false;
        let covers = true;
        for (let k = 0; k < A.length; k++) {
          if (A[k].startsWith(':')) { hasParam = true; continue; }
          if (A[k] !== B[k]) { covers = false; break; }
        }
        if (covers && hasParam) out.push(`${method} ${late.path}`);
      }
    }
  }
  return [...new Set(out)];
}

describe('route registration order', () => {
  test('no static route is unreachably shadowed by an earlier /:param route', () => {
    const shadowed = findShadowed(walkRoutes(app)).filter((r) => !GUARDED.has(r));
    // If this fails: move the `/:param` route BELOW its static siblings in the
    // route file. If they live in different routers on the same mount prefix,
    // add objectIdOrSkip('<param>') to the earlier one and list the path in
    // GUARDED above, with a case in the reachability test below.
    expect(shadowed).toEqual([]);
  });

  test('every path in GUARDED is a real registered route', () => {
    // Keeps the list honest: a stale entry would silently weaken test 1.
    const known = new Set(walkRoutes(app).map((r) => `${r.method} ${r.path}`));
    expect([...GUARDED].filter((r) => !known.has(r))).toEqual([]);
  });
});

describe('guarded static routes reach their own handler', () => {
  // These requests are AUTHENTICATED on purpose. An unauthenticated probe proves
  // nothing: the shadowing `/:param` routes are auth-gated too, so both the right
  // and the wrong handler answer 401 and the test would pass with the guard
  // removed. Past auth, the two diverge — so each case asserts on a string only
  // the intended handler produces.
  let user;
  let token;

  beforeAll(async () => {
    user = await User.create({
      email: 'route-shadowing@example.com',
      password: 'password123',
      name: 'Shadow',
      emailVerified: true,
    });
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  });

  afterAll(async () => {
    await User.deleteMany({ _id: user._id });
  });

  //          method  path                              a phrase ONLY this handler emits
  const cases = [
    ['get', '/api/approvals/dashboard', /Dashboard retrieved/i],
    ['get', '/api/approvals/delegations', /Delegations retrieved/i],
    ['get', '/api/approvals/sla-alerts', /SLA alerts retrieved/i],
    ['get', '/api/ai/templates/suggestions', /Template suggestions retrieved/i],
    // Validation errors from the real handler, which is equally conclusive: the
    // shadowing route never looks at agencyWorkspaceId or an approvalIds array.
    ['get', '/api/reports/scheduled', /Agency workspace ID is required/i],
    ['post', '/api/approvals/bulk/approve', /Approval IDs array is required/i],
    ['post', '/api/approvals/bulk/reject', /Approval IDs array is required/i],
    ['post', '/api/approvals/bulk/request-changes', /Approval IDs array is required/i],
  ];

  test.each(cases)('%s %s answers from its own handler', async (method, path, signature) => {
    const res = await request(app)[method](path)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).not.toBe(404);
    expect(JSON.stringify(res.body)).toMatch(signature);
  });
});

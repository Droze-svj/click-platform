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
const { walkRoutes, decodeMountPath } = require('../smoke/walkRoutes');

// Same walk as walkRoutes, WITHOUT its de-duplication, so a method+path
// registered twice appears twice. walkRoutes keeps only the first (it answers
// "what can be reached"); this needs "what was registered", because the second
// registration of a path is code that can never run.
function walkRegistrations(expressApp) {
  const out = [];
  function visit(stack, prefix) {
    for (const layer of stack) {
      if (layer.route) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const p of paths) {
          const full = `${prefix}${p}`.replace(/\/{2,}/g, '/') || '/';
          for (const m of Object.keys(layer.route.methods || {}).filter((x) => x !== '_all')) {
            out.push({
              key: `${m.toUpperCase()} ${full}`,
              // The terminal handler identifies the implementation: the same
              // router mounted at two prefixes yields the same function object.
              handler: (layer.route.stack || []).map((s) => s.handle).pop(),
            });
          }
        }
      } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
        visit(layer.handle.stack, `${prefix}${decodeMountPath(layer)}`);
      }
    }
  }
  visit((expressApp._router || expressApp.router).stack, '');
  return out;
}

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

  // beforeEach, not beforeAll, and an upsert rather than a create: several route
  // suites in this project call an UNSCOPED User.deleteMany({}) in their own
  // afterEach (tests/setup.js says so), so a user made once at file start can
  // vanish underneath these tests. Re-asserting it per test costs nothing and
  // removes a source of cross-suite flakiness.
  beforeEach(async () => {
    user = await User.findOneAndUpdate(
      { email: 'route-shadowing@example.com' },
      { $setOnInsert: { password: 'password123', name: 'Shadow', emailVerified: true } },
      { new: true, upsert: true }
    );
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'route-shadowing@example.com' });
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

// ─────────────────────────────────────────────────────────────────────────────
// The sibling bug class: the same method+path registered twice with DIFFERENT
// implementations. Only the first ever runs, so the second is unreachable code
// that still looks live in the editor — edit it and nothing changes.
//
// Registering the same ROUTER at several prefixes is fine and common here (many
// routers are mounted on three or four), so the check compares the terminal
// handler function: identical function object = one implementation, no finding.

// Duplicates that are accepted, each checked by hand. Every entry states why the
// first registration winning is correct, or why the shadowed one is not lost.
const ACCEPTED_DUPLICATES = new Map([
  ['GET /api/approvals/', 'approvals.js and approval-workflow.js both list approvals; the live one is the fuller listing'],
  ['POST /api/approvals/:approvalId/approve', 'both delegate to multiStepWorkflowService.advanceToNextStage — same behaviour'],
  ['POST /api/approvals/:approvalId/reject', 'as above'],
  ['POST /api/approvals/:approvalId/request-changes', 'as above'],
  ['POST /api/approvals/:approvalId/delegate', 'live path (workflow-enhanced → approvalDelegationService) rejects a caller not assigned to the stage, which is the tighter check; the shadowed one relies on requireApprovalAccess'],
  ['GET /api/monitoring/metrics', 'the LIVE one is auth+requireAdmin; the shadowed one has no auth at all — the strict one wins, which is the safe direction'],
  ['GET /api/monitoring/alerts', 'as above'],
  ['POST /api/workspaces/sync-all', 'two unrelated features collide only on the shared /api/workspaces prefix: audience-growth sync (live, user-scoped) and an admin-gated competitor sync. Both are reachable on their own prefixes, /api/audience-growth/sync-all and /api/competitors/sync-all'],
  ['GET /api/clients/:clientWorkspaceId/health-alerts', 'live is requireWorkspaceAccess(\'canView\'); the shadowed one uses the looser default — the strict one wins'],
  ['GET /api/subscription/status', 'duplicate listing implementations, same middleware chain'],
  ['GET /api/analytics/creator/stats', 'duplicate listing implementations, same middleware chain'],
  ['GET /api/analytics/performance/global', 'three registrations, same middleware chain'],
  ['GET /api/agency/dashboard', 'duplicate dashboard implementations, same middleware chain'],
  ['PUT /api/posts/:postId/comments/:commentId/resolve', 'duplicate implementations, same middleware chain'],
  ['POST /api/pro-mode/automation', 'duplicate implementations, same middleware chain'],
]);

describe('duplicate route registrations', () => {
  let byKey;

  beforeAll(() => {
    byKey = new Map();
    for (const { key, handler } of walkRegistrations(app)) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(handler);
    }
  });

  test('no method+path has two DIFFERENT implementations', () => {
    const offenders = [];
    for (const [key, handlers] of byKey) {
      if (handlers.length < 2) continue;
      if (handlers.every((h) => h === handlers[0])) continue; // one router, several mounts
      if (ACCEPTED_DUPLICATES.has(key)) continue;
      offenders.push(`${key} (${handlers.length} registrations)`);
    }
    // If this fails: only the FIRST registration runs. Either delete the dead
    // one, move it to a path of its own, or — if the collision is deliberate —
    // add it to ACCEPTED_DUPLICATES with the reason the winner is the right one.
    //
    // This check found GET /api/upload/progress/:uploadId, where an
    // unauthenticated stub was shadowing an authenticate + ownsUpload handler,
    // and the second POST /api/auth/resend-verification, half of a parallel
    // email-verification system built on a table no migration creates.
    expect(offenders).toEqual([]);
  });

  test('the accept-list has no stale entries', () => {
    const stale = [...ACCEPTED_DUPLICATES.keys()].filter((key) => {
      const handlers = byKey.get(key) || [];
      return handlers.length < 2 || handlers.every((h) => h === handlers[0]);
    });
    // A duplicate that resolved itself should drop off the list, not linger and
    // quietly widen what test 1 tolerates.
    expect(stale).toEqual([]);
  });
});

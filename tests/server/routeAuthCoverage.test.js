// Every mounted route must either require authentication or be on the public
// list below, with a reason.
//
// This exists because GET /api/dev/db-cleanup shipped with no auth, no
// NODE_ENV guard, and dropDatabase() on every database on the cluster. Nothing
// caught it: the endpoint sweeps only assert "no 5xx", and a wide-open endpoint
// answers 200.
//
// The check must account for router-level middleware. Auth is usually applied
// per route (`router.get('/x', auth, …)`) but sometimes for a whole router
// (`router.use(auth)` — disaster-recovery does this). A per-route scan alone
// reports ~187 false positives, so this walks the stack carrying inherited
// middleware down into each sub-router.

const app = require('../../server/index');
const { decodeMountPath } = require('../smoke/walkRoutes');

// Anything that establishes identity, or verifies a caller some other way.
const AUTH_MIDDLEWARE = new Set([
  'auth', 'authenticate', 'authenticateToken', 'requireAuth', 'optionalAuth',
  'requireAdmin', 'tusAuth', 'requireSignedMedia', 'verifyWebhook',
  'requireApiKey', 'apiKeyAuth', 'portalAuth', 'requireWorkspaceAccess',
]);

// Routes that are public on purpose. Each needs a reason; a bare path is not
// enough, because "it was already public" is exactly how db-cleanup survived.
const PUBLIC = new Map([
  [/^\/api\/health/, 'liveness/readiness — must answer before auth is possible'],
  [/^\/health/, 'as above'],
  [/^\/api\/monitoring\/health$/, 'liveness probe'],
  [/^\/api\/status\//, 'public status page'],
  [/^\/api\/auth\/(login|register|refresh|logout|forgot|reset|verify|resend|check-password|2fa|reactivate|registration-config|validate-reset-token)/,
    'the endpoints you use to GET a credential'],
  [/^\/api\/sso\//, 'SSO handshake + SCIM, which authenticates with its own token'],
  [/^\/api\/oauth\/(?:[a-z]+|:platform)\/callback$/, 'the provider redirects here with a code; it cannot carry our session'],
  [/^\/api\/webhooks\//, 'inbound provider webhooks, verified by signature not session'],
  [/^\/api\/subscription\/webhook$/, 'signed Whop webhook'],
  [/^\/api\/clicks\/(track|track-conversion|webhooks)/, 'tracking pixels fired from published posts'],
  [/^\/api\/(conversions|posts|workspaces)\/(track|track-conversion|webhooks)/, 'as above'],
  [/^\/l\/:shortCode$/, 'public short-link redirect'],
  [/^\/api\/analytics\/global/, 'landing-page marketing stats, public by design and documented as such'],
  [/^\/api\/plans$/, 'public pricing table used by the marketing site'],
  [/^\/api\/pricing\//, 'public pricing pages'],
  [/^\/api\/billing\/promo-codes$/, 'publicly ADVERTISED promo codes only — PromoCode.isPublic defaults false, so targeted/referral codes are excluded (see promoCodeVisibility.test.js)'],
  [/^\/api\/oauth\/status$/, 'which providers are configured — booleans only, no user data and no secrets; the connect UI reads it before a session exists'],
  [/^\/api\/oauth\/[a-z]+\/health$/, 'per-provider { configured: bool }, same rationale'],
  [/^\/api\/membership\/(packages|pricing)/, 'public pricing pages'],
  [/^\/api\/(help|support)\//, 'public help centre'],
  [/^\/api\/marketing-knowledge\//, 'static reference content'],
  [/^\/api\/(intelligence|playbooks)\/(niche|niches|marketplace|strategist)/, 'public discovery surfaces'],
  [/^\/api\/templates\/marketplace/, 'public template marketplace listings'],
  [/^\/api\/video\/voice-hooks\/(library|categories|popular|templates|marketplace|preview)/, 'public hook library'],
  [/^\/api\/trust\//, 'public provenance + social proof'],
  [/^\/api\/dmca\//, 'DMCA notices must be filable without an account'],
  [/^\/api\/white-label\//, 'branding/theme served to unauthenticated pages'],
  [/^\/api\/push\/vapid-key$/, 'public key, by definition'],
  [/^\/api\/debug\//, 'mounted only when NODE_ENV !== production'],
  [/^\/api\/(email-approval|simple-portal|client-portal)\//, 'token-in-URL approval flows for people with no account'],
  [/^\/api\/(approvals|clients|posts|workspaces|reports)\/:token/, 'token-in-URL share/approval links'],
  [/^\/api\/reports\/shared\/:token$/, 'token-in-URL shared report'],
  [/^\/api\/(brand|content-ops|integrations|database|admin|disaster-recovery|test-mi|video\/test|free-ai-models)/,
    'router-level auth (router.use) or an API-key middleware the name scan cannot see — verified by probe'],
  [/^\/api\/cdn\/url$/, 'builds a public asset URL'],
  [/^\/$/, 'root'],
  // Not listed: /api-docs and /uploads. Neither is a route layer — swagger-ui
  // and express.static are plain middleware — so they never reach this walk.
  // (requireSignedMedia still runs ahead of the /uploads static handler.)
]);

function reasonFor(path) {
  for (const [re, why] of PUBLIC) if (re.test(path)) return why;
  return null;
}

/** Walk the app, carrying router-level middleware into nested routers. */
function walkWithInherited(expressApp) {
  const out = [];
  function visit(stack, prefix, inherited) {
    // Middleware registered on this router with NO path — `router.use(auth)` —
    // applies to every route below it. Middleware mounted at a path, such as
    // `app.use('/uploads', requireSignedMedia)`, does NOT, and counting it was a
    // real hole: a global-looking scan treated every app-level route as
    // authenticated, so an injected `app.get('/api/dev/db-cleanup2')` passed this
    // test. `regexp.fast_slash` is Express's own marker for "mounted at /".
    const routerLevel = [...inherited];
    for (const layer of stack) {
      if (layer.route || layer.name === 'router') continue;
      if (typeof layer.handle !== 'function' || !layer.handle.name) continue;
      if (!layer.regexp || layer.regexp.fast_slash) routerLevel.push(layer.handle.name);
    }
    for (const layer of stack) {
      if (layer.route) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const p of paths) {
          const full = `${prefix}${p}`.replace(/\/{2,}/g, '/') || '/';
          for (const m of Object.keys(layer.route.methods || {}).filter((x) => x !== '_all')) {
            out.push({
              method: m.toUpperCase(),
              path: full,
              mw: routerLevel.concat((layer.route.stack || []).map((s) => s.handle.name || '<anon>')),
            });
          }
        }
      } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
        visit(layer.handle.stack, `${prefix}${decodeMountPath(layer)}`, routerLevel);
      }
    }
  }
  visit((expressApp._router || expressApp.router).stack, '', []);
  return out;
}

describe('route authentication coverage', () => {
  test('no route is unauthenticated without a stated reason', () => {
    const routes = walkWithInherited(app);
    expect(routes.length).toBeGreaterThan(1000); // the walk really ran

    // Only the FIRST registration of a method+path ever runs (Express matches in
    // order), so a later, unauthenticated duplicate is unreachable and must not
    // be reported. /api/monitoring/metrics is exactly this: the live route is
    // auth+requireAdmin and a dead second copy has no auth at all.
    const firstOnly = [];
    const seen = new Set();
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      firstOnly.push(r);
    }

    const offenders = firstOnly
      .filter((r) => !r.mw.some((name) => AUTH_MIDDLEWARE.has(name)))
      .filter((r) => reasonFor(r.path) === null)
      .map((r) => `${r.method} ${r.path}`);

    // If this fails: add auth to the route, or — if it is genuinely public — add
    // it to PUBLIC above WITH the reason it is safe to expose. Do not add a path
    // just to silence this; GET /api/dev/db-cleanup was "already public" too, and
    // it dropped every database on the cluster.
    expect([...new Set(offenders)].sort()).toEqual([]);
  });

  test('the public list has no dead entries', () => {
    // A pattern matching nothing means the route was renamed or removed, and the
    // exemption is now silently covering whatever else it happens to match.
    const routes = walkWithInherited(app);
    const unused = [...PUBLIC.keys()].filter((re) => !routes.some((r) => re.test(r.path)));
    expect(unused.map(String)).toEqual([]);
  });
});

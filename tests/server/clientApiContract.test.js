// Guards the "client calls an endpoint that doesn't exist" bug class.
//
// clientApiPrefix.test.js catches paths that are wrong in SHAPE (a stray /api
// prefix). This catches paths that are well-formed but point at nothing: the
// client issues the request, the server 404s, and — because almost every one of
// these call sites ends in a `.catch(() => {})` or a console.error — the feature
// silently does nothing. There is no error in the UI and none in the logs.
//
// The 2026-08 audit found 30 such paths. The ones that mattered:
//
//   • GET /video/clips/:clipId          scheduler prefill — no such route (clips
//                                       are addressed as /video/clips/hub/:contentId).
//                                       "Send to Scheduler" never prefilled anything.
//   • POST /user/profile                ProfileHUD save — the route is
//                                       PUT /auth/profile. Every save 404'd.
//   • /phase10_12/*, /phase16_18/*      13 calls; the routers were mounted only at
//                                       the single-phase prefixes (/phase10, …).
//   • /sovereign/{arbitrage-triggers,   4 calls; those handlers live in
//     fiscal-velocity, …}               routes/click.js, mounted at /api/click.
//
// How it works: boot the real app, walk its router stack (the same walker the
// endpoint sweeps use, so it reflects what is actually mounted rather than what
// index.js appears to mount), and compare against every static path passed to an
// api* helper in the client.
//
// If this test fails, a client call has no server route. Fix the path — or, if
// the mismatch is an artifact of how the path is built, add it to
// ACCEPTED_UNRESOLVED below WITH a reason.

const fs = require('fs');
const path = require('path');

const CLIENT_DIR = path.join(__dirname, '../../client');
const { walkRoutes } = require('../smoke/walkRoutes');

// Paths this test cannot resolve, each verified by hand. Keep the reasons.
const ACCEPTED_UNRESOLVED = new Map([
  // ── Built by concatenation: the regex captures only the leading literal, so
  //    the real request has segments this test never sees. All verified mounted.
  ['/api/seo/video-retention', "concatenated: '/seo/video-retention/' + externalId → /api/seo/video-retention/:externalId"],
  ['/api/translation/content', "concatenated: '/translation/content/' + id + '/translations' → mounted"],
  ['/api/jobs/dead-letter:x', 'template `/jobs/dead-letter${qs}` — qs is a query string, route is /api/jobs/dead-letter'],

  // ── JSDoc examples in the api helper and hook, not real call sites.
  ['/api/users', 'lib/api.ts usage example in a doc comment'],
  ['/api/users/123', 'lib/api.ts usage example in a doc comment'],
  ['/api/brand-kit', 'hooks/useHardenedRequest.ts usage example in a doc comment'],


  // ── Variable platform segment with no generic route: the server-side code
  //    exchange is mounted per platform (POST /api/oauth/{linkedin,google,
  //    facebook,tiktok,youtube}/complete), so `/oauth/${platform}/complete`
  //    normalises to :x and cannot be resolved statically. Those five are the
  //    only platforms that support it.
  ['/api/oauth/:x/complete', 'per-platform routes: linkedin|google|facebook|tiktok|youtube each mount POST /complete'],
]);

// Components with ZERO importers that call endpoints which do not exist. Not a
// bug while nothing renders them — but each is a break waiting to happen, so
// they are listed rather than ignored, and a test below fails if one is wired
// up while its endpoints are still missing.
//
// Empty since 2026-09-11: the seven listed here (CreatorDNA, SystemIntelligence,
// TrendRadar, BackupManager, ChunkedUpload, WorkflowWebhookManager,
// SocialPublishingView) were deleted rather than kept as exemptions. The
// mechanism stays for the next orphan that turns up.
const UNREACHABLE_COMPONENTS = new Set([]);

function walk(dir) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|\.next|\bdist\b|\bcoverage\b|__tests__/.test(p)) continue;
      out = out.concat(walk(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\s\d+\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const CALL_RE = /\bapi(Get|Post|Put|Delete|Patch)\s*(?:<[^>]*>)?\s*\(\s*([`'"])((?:\\.|(?!\2).)*)\2/g;
const VERB = { Get: 'GET', Post: 'POST', Put: 'PUT', Delete: 'DELETE', Patch: 'PATCH' };

// Collapse a path to the shape the router matches on: drop the query string and
// replace every dynamic segment (a `${…}` hole or an Express `:param`) with :x.
//
// A NESTED template literal (`…${qs ? `?${qs}` : ''}`) ends the outer capture at
// the inner backtick, leaving an unterminated `${`. Everything from there on is
// a tail we could not parse, so it is dropped — which can only cause a missed
// mismatch, never a false one.
function normalize(p) {
  let out = p
    .split('?')[0]
    .replace(/\$\{[^}]*\}/g, ':x');
  const unterminated = out.indexOf('${');
  if (unterminated !== -1) out = out.slice(0, unterminated);
  return out.replace(/\/$/, '').replace(/\/:[A-Za-z_][A-Za-z0-9_]*/g, '/:x');
}

describe('every client API call resolves to a mounted server route', () => {
  let mounted;
  let mountedWithVerb;

  beforeAll(() => {
    // Booting the app registers the routers; walkRoutes then reports what is
    // genuinely reachable, including nested sub-routers.
    const app = require('../../server/index');
    const routes = walkRoutes(app);
    mounted = new Set(routes.map((r) => normalize(r.path)));
    mountedWithVerb = new Set(routes.map((r) => `${r.method} ${normalize(r.path)}`));
  });

  test('the app exposes a route table to compare against', () => {
    // A sanity floor: if the app failed to boot, `mounted` would be tiny and the
    // real assertion below would "pass" by reporting everything as broken.
    expect(mounted.size).toBeGreaterThan(500);
  });

  test('no api* call points at an unmounted path', () => {
    const unresolved = new Map();

    for (const file of walk(CLIENT_DIR)) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      CALL_RE.lastIndex = 0;
      while ((m = CALL_RE.exec(src))) {
        const raw = m[3];
        if (!raw.startsWith('/')) continue; // relative/dynamic — nothing to check
        const full = normalize('/api' + raw);
        if (mounted.has(full)) continue;
        if (ACCEPTED_UNRESOLVED.has(full)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        if (!unresolved.has(full)) unresolved.set(full, []);
        unresolved.get(full).push(`${path.relative(CLIENT_DIR, file)}:${line}`);
      }
    }

    // If this fails: the listed path has no server route. Either correct the
    // client path, mount the route, or add it to ACCEPTED_UNRESOLVED with a
    // reason if it is an artifact of string concatenation.
    expect(Object.fromEntries(unresolved)).toEqual({});
  });

  // A path that exists but is served under a different VERB 404s exactly like a
  // path that does not exist, and the test above cannot see it: POST
  // /api/niche/personalize matched the mounted PUT route by path, so the
  // onboarding call that silently never saved the user's platform focus passed
  // this file for months. Same for POST /api/oauth/:x/callback, whose callback
  // routes are GET (the provider redirects a browser to them).
  test('no api* call uses a verb the route does not serve', () => {
    const wrongVerb = new Map();

    for (const file of walk(CLIENT_DIR)) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      CALL_RE.lastIndex = 0;
      while ((m = CALL_RE.exec(src))) {
        const raw = m[3];
        if (!raw.startsWith('/')) continue;
        const full = normalize('/api' + raw);
        // Only meaningful for paths that resolve; unresolved ones are the other
        // test's business, and accepted ones cannot be checked statically.
        if (!mounted.has(full) || ACCEPTED_UNRESOLVED.has(full)) continue;
        const method = VERB[m[1]];
        if (mountedWithVerb.has(`${method} ${full}`)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        const key = `${method} ${full}`;
        if (!wrongVerb.has(key)) wrongVerb.set(key, []);
        wrongVerb.get(key).push(`${path.relative(CLIENT_DIR, file)}:${line}`);
      }
    }

    // If this fails: the path is right but the method is not. Match the verb the
    // route is mounted with (or mount the verb the client needs).
    expect(Object.fromEntries(wrongVerb)).toEqual({});
  });

  // ── Raw fetch() calls ──────────────────────────────────────────────────────
  // The tests above only see the api* helpers. Roughly 100 call sites use
  // fetch('/api/…') directly, and none of them were checked — which is how the
  // entire /dashboard/compliance page shipped calling six moderation endpoints
  // that did not exist, every one behind `if (res.ok)` / `catch { silent }`, so
  // it rendered an empty rule list with no error at all.
  test('no raw fetch("/api/…") points at an unmounted path', () => {
    const unresolved = new Map();

    for (const file of walk(CLIENT_DIR)) {
      const rel = path.relative(CLIENT_DIR, file);
      if (UNREACHABLE_COMPONENTS.has(rel)) continue;
      const src = fs.readFileSync(file, 'utf8');
      const lines = src.split('\n');
      const re = /fetch\(\s*[`'"](\/api\/[^`'"]*)[`'"]/g;
      let m;
      while ((m = re.exec(src))) {
        const line = src.slice(0, m.index).split('\n').length;
        // JSDoc @example blocks are documentation, not call sites.
        if (/^\s*\*/.test(lines[line - 1] || '')) continue;
        const full = normalize(m[1]);
        if (mounted.has(full)) continue;
        if (ACCEPTED_UNRESOLVED.has(full)) continue;
        if (!unresolved.has(full)) unresolved.set(full, []);
        unresolved.get(full).push(`${rel}:${line}`);
      }
    }

    expect(Object.fromEntries(unresolved)).toEqual({});
  });

  test('the unreachable-component exemptions really have no importers', () => {
    // These components call endpoints that do not exist, which is harmless only
    // while nothing renders them. If one gets wired up, delete it from the set
    // and let the test above hold its calls to account.
    const files = walk(CLIENT_DIR);
    const imported = [];
    for (const rel of UNREACHABLE_COMPONENTS) {
      const name = path.basename(rel).replace(/\.tsx?$/, '');
      const referenced = files.some((f) =>
        path.relative(CLIENT_DIR, f) !== rel
        && new RegExp(`\\b${name}\\b`).test(fs.readFileSync(f, 'utf8')));
      if (referenced) imported.push(rel);
    }
    expect(imported).toEqual([]);
  });

  test('the accept-list has no stale entries', () => {
    // An entry that now resolves means the path was fixed and the exception
    // should be deleted, so the list stays a record of real exceptions only.
    const stale = [...ACCEPTED_UNRESOLVED.keys()].filter((p) => mounted.has(p));
    expect(stale).toEqual([]);
  });
});

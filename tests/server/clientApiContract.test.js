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

  // ── Live in components with zero importers (confirmed by import-graph
  //    reachability from app/ entry points). Not user-reachable, so not a bug;
  //    listed so that WIRING one of these up surfaces the broken path first.
  ['/api/social/generate-metadata', 'components/editor/views/SocialPublishingView.tsx — orphaned, 0 importers'],
  ['/api/social/publish', 'components/editor/views/SocialPublishingView.tsx — orphaned, 0 importers'],
]);

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

const CALL_RE = /\bapi(?:Get|Post|Put|Delete|Patch)\s*(?:<[^>]*>)?\s*\(\s*([`'"])((?:\\.|(?!\1).)*)\1/g;

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

  beforeAll(() => {
    // Booting the app registers the routers; walkRoutes then reports what is
    // genuinely reachable, including nested sub-routers.
    const app = require('../../server/index');
    mounted = new Set(walkRoutes(app).map((r) => normalize(r.path)));
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
        const raw = m[2];
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

  test('the accept-list has no stale entries', () => {
    // An entry that now resolves means the path was fixed and the exception
    // should be deleted, so the list stays a record of real exceptions only.
    const stale = [...ACCEPTED_UNRESOLVED.keys()].filter((p) => mounted.has(p));
    expect(stale).toEqual([]);
  });
});

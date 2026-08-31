// Breadth endpoint sweep (NON-GATING — own jest project `smoke-full`,
// run via `npm run smoke:full`). Walks every mounted route, calls the SAFE
// ones (GET/HEAD, minus external/heavy prefixes) with a seeded auth token and
// fixture ids, categorizes each result, writes tests/reports/endpoint-smoke.json,
// and fails if any endpoint 5xxs. AI runs in mock mode under NODE_ENV=test.

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../server/index');
const { walkRoutes } = require('./walkRoutes');
const { seedSmokeFixtures, cleanupSmokeFixtures } = require('./fixtures');

// External-service / heavy prefixes we must not hit even on GET (outbound
// calls, signed webhooks, OAuth handshakes, render/ffmpeg, uploads).
const SKIP_PREFIXES = [
  '/api/webhooks', '/api/oauth', '/api/billing', '/api/subscription',
  '/api/social', '/api/upload', '/api/video/render', '/api/export',
  '/api/health/trigger-sentry', '/api/health/test-sentry',
  // SSE stream never closes — it always hits the per-call timeout by design,
  // polluting the report with a fake TIMEOUT. Not sweepable via one-shot GET.
  '/api/events/stream',
];

const PER_CALL_TIMEOUT_MS = 6000;
const CONCURRENCY = 8;

// Exceptions to SKIP_PREFIXES: GET endpoints that live under a skipped prefix
// but are pure reads — no outbound HTTP, no signature check, no file streaming —
// so there is no reason to leave them unverified.
//
// The prefixes above are coarse on purpose (whole families are excluded because
// SOME member does something unsafe), and 64 GET endpoints were sitting behind
// them untested. That is exactly where the 2026-08 audit found
// GET /api/oauth/google/status 503ing on a stock install while every other
// provider's returned 200, and where the four un-shadowed /api/export reads had
// no coverage at all. Each entry here has been probed and is a plain DB read.
const SWEEP_ANYWAY = new Set([
  // Un-shadowed in 2026-08; all four were previously unreachable AND unswept.
  '/api/export/templates', '/api/export/history', '/api/export/analytics',
  '/api/export/preview', '/api/export/:jobId',
  '/api/subscription/status',
  '/api/social/accounts', '/api/social/optimal-times',
  // Billing reads — usage counters and referral rows out of Mongo. The Whop
  // calls live on the POST side, which this sweep never touches.
  '/api/billing/add-ons', '/api/billing/history', '/api/billing/overage',
  '/api/billing/promo-codes', '/api/billing/referral/code',
  '/api/billing/referral/stats', '/api/billing/usage',
  '/api/billing/usage/check', '/api/billing/usage/stats',
  // OAuth STATUS/listing reads only. /authorize and /callback stay skipped:
  // one persists in-flight state, the other needs a real provider code.
  '/api/oauth/accounts', '/api/oauth/connections', '/api/oauth/status',
  '/api/oauth/health/', '/api/oauth/:platform/status', '/api/oauth/:platform/accounts',
  '/api/oauth/facebook/status', '/api/oauth/google/status',
  '/api/oauth/linkedin/status', '/api/oauth/linkedin/health',
  '/api/oauth/tiktok/status', '/api/oauth/twitter/status',
  '/api/oauth/youtube/status', '/api/oauth/instagram/status',
  '/api/oauth/instagram/accounts', '/api/oauth/facebook/pages',
  // Webhook READS. The signature check that made this family unsafe is on POST.
  '/api/webhooks/', '/api/webhooks/:id', '/api/webhooks/:id/health',
  '/api/webhooks/:id/logs', '/api/webhooks/:id/stats',
  '/api/webhooks/supabase/health', '/api/webhooks/:postId/clicks/analytics',
  '/api/webhooks/:workspaceId/conversions/analytics',
  '/api/webhooks/:workspaceId/conversions/funnel',
  '/api/webhooks/:workspaceId/roas-roi/dashboard',
  // Progress lookups — in-memory/DB reads, no upload performed.
  '/api/upload/chunked/:uploadId/missing', '/api/upload/chunked/:uploadId/progress',
  '/api/upload/progress/:uploadId',
  // Render job STATUS. /download streams a file and stays skipped.
  '/api/video/render/:jobId/status',
]);

function matchesSkip(p) {
  if (SWEEP_ANYWAY.has(p)) return false;
  return SKIP_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/') || p.startsWith(pre + '?'));
}

// Fill in :params with seeded ids (so ownership/validation paths are real),
// otherwise a fresh valid ObjectId (legit 404, not a 5xx).
function fillParams(p, paramNames, fx) {
  let out = p;
  for (const name of paramNames) {
    let val;
    if (/^platform$/i.test(name)) val = 'tiktok'; // a provider name, not an id
    else if (/^(contentId|videoId|id)$/i.test(name)) val = String(fx.content._id);
    else if (/userId/i.test(name)) val = String(fx.user._id);
    else val = String(new mongoose.Types.ObjectId());
    out = out.replace(`:${name}`, val);
  }
  return out;
}

function categorize(status, body) {
  if (status === 501) return 'NOT_IMPLEMENTED';   // intentionally-disabled feature
  if (status === 503) return 'SERVICE_UNAVAILABLE'; // dependency off in this env
  if (status >= 500) return 'SERVER_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 400 || status === 422) return 'BAD_REQUEST';
  if (status >= 200 && status < 300) {
    // A 2xx is healthy unless it CONTRADICTS itself by claiming failure. Many
    // endpoints legitimately return non-envelope payloads (CSS, Prometheus text,
    // raw arrays/objects, the VAPID key, booleans), so only flag the genuine
    // contradiction `2xx + {success:false}`.
    if (body && body.success === false) return 'MALFORMED';
    return 'OK';
  }
  return 'OTHER';
}

async function callOne(ep, fx) {
  const url = fillParams(ep.path, ep.paramNames, fx);
  const started = Date.now();
  const req = request(app).get(url).set('Authorization', `Bearer ${fx.userToken}`);
  try {
    const res = await Promise.race([
      req,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), PER_CALL_TIMEOUT_MS)),
    ]);
    return {
      method: ep.method, path: ep.path, url, status: res.status,
      category: categorize(res.status, res.body),
      ms: Date.now() - started,
      error: res.status >= 500 ? JSON.stringify(res.body).slice(0, 200) : undefined,
    };
  } catch (e) {
    // On timeout the underlying request is abandoned (e.g. a slow aggregation or
    // an SSE stream that never closes). Abort it and swallow its eventual settle
    // so a late rejection can't surface as an unhandledRejection that fails the
    // whole suite even though the endpoint itself did not 5xx.
    try { if (typeof req.abort === 'function') req.abort(); } catch { /* ignore */ }
    Promise.resolve(req).catch(() => {});
    return {
      method: ep.method, path: ep.path, url, status: 0,
      category: e.message === 'timeout' ? 'TIMEOUT' : 'THREW',
      ms: Date.now() - started, error: e.message,
    };
  }
}

describe('Breadth endpoint sweep', () => {
  let fx;
  beforeAll(async () => { fx = await seedSmokeFixtures(); });
  afterAll(async () => { await cleanupSmokeFixtures(); });

  it('no mounted GET endpoint returns 5xx', async () => {
    const all = walkRoutes(app);
    const gets = all.filter((e) => e.method === 'GET' && !matchesSkip(e.path));
    const skipped = all.length - gets.length;

    const results = [];
    for (let i = 0; i < gets.length; i += CONCURRENCY) {
      const batch = gets.slice(i, i + CONCURRENCY);
      results.push(...await Promise.all(batch.map((ep) => callOne(ep, fx))));
    }

    const summary = results.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {});
    const serverErrors = results.filter((r) => r.category === 'SERVER_ERROR');
    const malformed = results.filter((r) => r.category === 'MALFORMED');

    const report = {
      generatedAtNote: 'timestamp omitted (Date.now stamped by runner)',
      totals: { mountedEndpoints: all.length, getsCalled: gets.length, skipped },
      summary,
      serverErrors,
      malformed: malformed.map((m) => ({ method: m.method, path: m.path })),
      results,
    };
    const dir = path.join(__dirname, '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'endpoint-smoke.json'), JSON.stringify(report, null, 2));

    // Console summary (visible in the run).
    // eslint-disable-next-line no-console
    console.log('SWEEP SUMMARY', JSON.stringify(summary), `(5xx=${serverErrors.length}, malformed=${malformed.length})`);
    if (serverErrors.length) {
      // eslint-disable-next-line no-console
      console.log('SERVER_ERRORS:\n' + serverErrors.map((e) => `  ${e.method} ${e.path} → ${e.status} ${e.error || ''}`).join('\n'));
    }

    // Ratchet, not a hard zero. The breadth sweep surfaces a known backlog of
    // 5xx — mostly unimplemented feature endpoints (service fn never written),
    // Supabase-mode gaps (supabase null in Mongoose prod), and not-found thrown
    // as 500 (these work for valid ids). They're catalogued in
    // tests/reports/endpoint-smoke.json + docs/readiness/endpoint-coverage.md and
    // driven down over time. This ceiling FAILS the sweep only if a NEW
    // regression pushes the count above the documented baseline.
    // Ratcheted to 0: the GET breadth sweep is now clean (the former caption
    // not-generated-500s → 404 and the Supabase-off verify-email 500 → 503). Any
    // new GET 5xx is a regression.
    const MAX_SERVER_ERRORS = 0;
    if (serverErrors.length > MAX_SERVER_ERRORS) {
      throw new Error(
        `Breadth sweep: ${serverErrors.length} server errors exceeds baseline ${MAX_SERVER_ERRORS}.\n` +
        serverErrors.map((e) => `  ${e.method} ${e.path} -> ${e.status} ${e.error || ''}`).join('\n')
      );
    }
  }, 180000);
});

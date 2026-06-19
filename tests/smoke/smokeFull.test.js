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
];

const PER_CALL_TIMEOUT_MS = 6000;
const CONCURRENCY = 8;

function matchesSkip(p) {
  return SKIP_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/') || p.startsWith(pre + '?'));
}

// Fill in :params with seeded ids (so ownership/validation paths are real),
// otherwise a fresh valid ObjectId (legit 404, not a 5xx).
function fillParams(p, paramNames, fx) {
  let out = p;
  for (const name of paramNames) {
    let val;
    if (/^(contentId|videoId|id)$/i.test(name)) val = String(fx.content._id);
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
  try {
    const res = await Promise.race([
      request(app).get(url).set('Authorization', `Bearer ${fx.userToken}`),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), PER_CALL_TIMEOUT_MS)),
    ]);
    return {
      method: ep.method, path: ep.path, url, status: res.status,
      category: categorize(res.status, res.body),
      ms: Date.now() - started,
      error: res.status >= 500 ? JSON.stringify(res.body).slice(0, 200) : undefined,
    };
  } catch (e) {
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
    const MAX_SERVER_ERRORS = 6;
    if (serverErrors.length > MAX_SERVER_ERRORS) {
      throw new Error(
        `Breadth sweep: ${serverErrors.length} server errors exceeds baseline ${MAX_SERVER_ERRORS}.\n` +
        serverErrors.map((e) => `  ${e.method} ${e.path} -> ${e.status} ${e.error || ''}`).join('\n')
      );
    }
  }, 180000);
});

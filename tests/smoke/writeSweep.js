#!/usr/bin/env node
// Standalone WRITE breadth sweep — `npm run smoke:writes`.
//
// Run as a plain Node script (NOT jest) on purpose: the sweep fires a body-less
// request at every mounted write endpoint, and a few routes fire-and-forget a
// Mongoose op (e.g. an un-awaited .save() that fails validation) AFTER the HTTP
// response is already sent. Under jest those background rejections are attributed
// to the test and fail it even though the endpoint returned a valid status. In a
// plain Node process a top-level unhandledRejection handler reliably swallows
// them, so the sweep gates ONLY on what it measures: HTTP-status correctness
// (5xx) and cross-user write IDOR.
//
// Isolation: forces an in-memory MongoDB (never a remote/Atlas URI — the
// dbSafety guard refuses those) and blanks REDIS_URL/SUPABASE_URL so the app
// boots on its no-redis / no-supabase paths. DRY_RUN_PUBLISH neutralizes any
// publish. Exit 0 = clean; exit 1 = a real 5xx or IDOR (or a boot failure).

/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');

// ── Isolated env (mirrors tests/setup-env.js) — set BEFORE requiring the app ──
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.REDIS_URL = '';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_ANON_KEY = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.DRY_RUN_PUBLISH = 'true';
process.env.AUTO_VERIFY_EMAIL = 'true';
process.env.DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT || 'true';
process.env.PORT = process.env.PORT || '0'; // ephemeral — never conflict with a running dev server

// Background async failures from body-less probes are noise, not endpoint 5xx.
const bgErrors = [];
process.on('unhandledRejection', (e) => { if (bgErrors.length < 50) bgErrors.push(String(e && e.stack ? e.stack : e).slice(0, 200)); });
process.on('uncaughtException', (e) => { if (bgErrors.length < 50) bgErrors.push('UNCAUGHT ' + String(e && e.stack ? e.stack : e).slice(0, 200)); });

const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Skipped because a body-less probe would do something real or unbounded:
// outbound posting/publishing, a live upload, an actual ffmpeg render, or an
// SSE stream that never closes.
//
// /api/billing, /api/subscription and /api/export were skipped here too, which
// left the entire paid-plan surface unswept — that is how the SupportTicket
// ticketNumber defect (every billing-support ticket creation failing) survived.
// They are safe to sweep: the probes carry an empty body, the DB is a throwaway
// in-memory instance, and the one outbound call in the family
// (POST /api/subscription/verify -> Whop) returns 400 on the missing id long
// before axios is reached. Keep them swept.
const SKIP_PREFIXES = [
  // Genuinely does something real or unbounded even from a body-less probe:
  // outbound platform calls, a live upload handshake, or an actual ffmpeg run.
  '/api/oauth', '/api/social',            // outbound to the platforms
  '/api/upload',                          // tus/chunked handshakes
  '/api/video/render', '/api/video/advanced', // spawn ffmpeg
  '/api/backup/restore',                  // overwrites data
  '/api/health/trigger-sentry', '/api/health/test-sentry',
  '/api/events/stream',                   // SSE, never closes
];
// NOTE: there is deliberately no publish/post/send suffix skip. It used to exist
// and it hid a real 500 — POST /api/posts/:id/publish threw with Supabase off,
// because it was the one handler in posts.js missing the store-not-configured
// guard its siblings all have. DRY_RUN_PUBLISH=true (set above) neutralises the
// publish paths, and with no platform tokens they fail closed anyway, so
// sweeping them is safe and demonstrably worth it.
const SKIP_SUFFIX = /^$/;
// Cross-user by design (verified): public help article vote + moderation flag.
const IDOR_ALLOWLIST = new Set([
  'POST /api/help/articles/:id/helpful',
  'POST /api/moderation/flag/:contentId',
]);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PER_CALL_TIMEOUT_MS = 6000;
const CONCURRENCY = 8;
const GENERIC_BODY = {}; // empty probe — see header

function matchesSkip(p) {
  if (SKIP_SUFFIX.test(p)) return true;
  return SKIP_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/'));
}
function signToken(userId) { return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, { expiresIn: '1h' }); }
function categorize(status, body) {
  if (status === 501) return 'NOT_IMPLEMENTED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'SERVER_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 400 || status === 422) return 'BAD_REQUEST';
  if (status >= 200 && status < 300) return (body && body.success === false) ? 'MALFORMED' : 'OK';
  return 'OTHER';
}
function fillParams(p, paramNames, fx, ownedId) {
  let out = p;
  for (const name of paramNames) {
    let val;
    if (/^(contentId|videoId|id)$/i.test(name)) val = ownedId === 'throwaway' ? String(new mongoose.Types.ObjectId()) : String(fx.content._id);
    else if (/userId/i.test(name)) val = String(fx.user._id);
    else val = String(new mongoose.Types.ObjectId());
    out = out.replace(`:${name}`, val);
  }
  return out;
}

async function main() {
  // Prefer a provided LOCAL TEST database (CI gives this job a mongo service,
  // where MongoMemoryServer cannot download its binary). Anything that is not
  // plainly a local test DB is ignored rather than connected to — this script
  // runs deleteMany-style writes, so it must never be pointed at real data.
  // Mirrors the rule in tests/setup-env.js.
  const provided = process.env.MONGODB_URI || '';
  const isLocalTestUri = /(127\.0\.0\.1|localhost)/.test(provided) && /test/i.test(provided)
    && !/mongodb\+srv:|\.mongodb\.net/i.test(provided);

  let mongod = null;
  if (isLocalTestUri) {
    await mongoose.connect(provided);
  } else {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }

  const app = require('../../server/index');
  const { walkRoutes } = require('./walkRoutes');
  const User = require('../../server/models/User');
  const Content = require('../../server/models/Content');

  // Seed user A (+ owned content) and user B (for IDOR).
  const user = await new User({ email: 'ws-a@example.com', password: 'password123', name: 'WS A', emailVerified: true }).save();
  const content = await new Content({ userId: user._id, title: 'WS Content', type: 'video', status: 'completed', transcript: 'x' }).save();
  const userB = await new User({ email: 'ws-b@example.com', password: 'password123', name: 'WS B', emailVerified: true }).save();
  const fx = { user, content, userToken: signToken(user._id), userBToken: signToken(userB._id) };

  const dispatch = (method, url, token) => request(app)[method.toLowerCase()](url).set('Authorization', `Bearer ${token}`).send(GENERIC_BODY);
  async function sendOnce(method, url, token) {
    const req = dispatch(method, url, token);
    try {
      return await Promise.race([req, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), PER_CALL_TIMEOUT_MS))]);
    } catch (e) { try { if (req.abort) req.abort(); } catch { /* ignore */ } Promise.resolve(req).catch(() => {}); throw e; }
  }

  async function callOne(ep) {
    const ownedId = ep.method === 'DELETE' ? 'throwaway' : 'A';
    const url = fillParams(ep.path, ep.paramNames, fx, ownedId);
    const started = Date.now();
    let result;
    try {
      let res = await sendOnce(ep.method, url, fx.userToken);
      if (res.status >= 500) res = await sendOnce(ep.method, url, fx.userToken); // retry once — flake guard
      result = { method: ep.method, path: ep.path, url, status: res.status, category: categorize(res.status, res.body), ms: Date.now() - started, error: res.status >= 500 ? JSON.stringify(res.body).slice(0, 200) : undefined };
    } catch (e) {
      return { method: ep.method, path: ep.path, url, status: 0, category: e.message === 'timeout' ? 'TIMEOUT' : 'THREW', ms: Date.now() - started, error: e.message };
    }
    const touchedOwned = /:(contentId|videoId|id)\b/.test(ep.path) && ep.method !== 'DELETE';
    if (touchedOwned && result.status >= 200 && result.status < 300) {
      try {
        const resB = await sendOnce(ep.method, url, fx.userBToken);
        if (resB.status >= 200 && resB.status < 300 && !(resB.body && resB.body.success === false)) { result.idor = true; result.idorStatus = resB.status; }
      } catch { /* B timeout ≠ IDOR */ }
    }
    return result;
  }

  const all = walkRoutes(app);
  const writes = all.filter((e) => WRITE_METHODS.has(e.method) && !matchesSkip(e.path));
  const results = [];
  for (let i = 0; i < writes.length; i += CONCURRENCY) {
    results.push(...await Promise.all(writes.slice(i, i + CONCURRENCY).map((ep) => callOne(ep))));
  }

  const summary = results.reduce((a, r) => { a[r.category] = (a[r.category] || 0) + 1; return a; }, {});
  const serverErrors = results.filter((r) => r.category === 'SERVER_ERROR');
  const idor = results.filter((r) => r.idor && !IDOR_ALLOWLIST.has(`${r.method} ${r.path}`));
  const malformed = results.filter((r) => r.category === 'MALFORMED');

  const report = {
    totals: { mountedEndpoints: all.length, writesCalled: writes.length },
    summary, serverErrors,
    idor: idor.map((m) => ({ method: m.method, path: m.path, idorStatus: m.idorStatus })),
    malformed: malformed.map((m) => ({ method: m.method, path: m.path })),
    backgroundErrorCount: bgErrors.length,
    results,
  };
  const dir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'endpoint-writes.json'), JSON.stringify(report, null, 2));

  console.log('WRITE SWEEP', JSON.stringify(summary), `(5xx=${serverErrors.length}, idor=${idor.length}, malformed=${malformed.length}, bg=${bgErrors.length})`);
  if (serverErrors.length) console.log('SERVER_ERRORS:\n' + serverErrors.map((e) => `  ${e.method} ${e.path} → ${e.status} ${e.error || ''}`).join('\n'));
  if (idor.length) console.log('IDOR:\n' + idor.map((e) => `  ${e.method} ${e.path} → B ${e.idorStatus}`).join('\n'));

  await mongoose.disconnect().catch(() => {});
  if (mongod) await mongod.stop().catch(() => {});

  const fail = serverErrors.length > 0 || idor.length > 0 || malformed.length > 0;
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('WRITE SWEEP FAILED TO RUN:', e && e.stack ? e.stack : e); process.exit(1); });

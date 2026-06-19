// Setup environment variables before Jest loads any test files
console.log('=== SETUP ENV RUNNING ===');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// ── HARD DATABASE SAFETY GUARD ──────────────────────────────────────────────
// Several route/integration suites call UNSCOPED User.deleteMany({}) /
// Content.deleteMany({}). If MONGODB_URI ever points at a real database those
// calls WIPE it. This actually happened once: .env holds the production Atlas
// URI, and because this file did not pin MONGODB_URI, requiring server/index.js
// let dotenv populate it from .env — so the suite connected to Atlas click_v3
// and emptied the users/contents collections.
//
// Fix: pin MONGODB_URI to an isolated local test DB HERE, before any test file
// (and therefore before server/index.js's dotenv) loads. dotenv never overrides
// an already-set env var, so this value wins. Anything that looks remote or
// isn't clearly a *test* DB is forced to the safe local URI. CI already sets a
// localhost click-test URI, which is preserved.
const existingMongo = process.env.MONGODB_URI || '';
const looksRemote = /mongodb\+srv:|\.mongodb\.net|@[^/]*\.(net|com|io|cloud)/i.test(existingMongo);
const looksLocalTest =
  /127\.0\.0\.1|localhost/.test(existingMongo) && /test/i.test(existingMongo);
if (!existingMongo || looksRemote || !looksLocalTest) {
  // Unsafe or unset → force the in-memory sandbox path. We pin a non-empty,
  // obviously-local placeholder URI (so the app's require-time env validation
  // passes and dotenv can't repopulate MONGODB_URI from .env's Atlas value),
  // and set a marker telling tests/setup.js to spin up an in-memory MongoDB and
  // use ITS uri instead of this placeholder. A genuinely-local click-test URI
  // (e.g. CI's service container) is preserved as-is and connected directly.
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/click-test';
  process.env.USE_INMEMORY_DB = '1';
}
// Expose the original (potentially unsafe) value for the fail-closed assertion
// in setup.js, purely for diagnostics — it is never connected to.
process.env.__ORIGINAL_MONGODB_URI = existingMongo;

// Force complete isolation from remote Upstash Redis during tests
process.env.REDIS_URL = 'redis://localhost:6379';

// Force Mongoose fallback for auth to keep tests sandboxed
process.env.ENABLE_SUPABASE_AUTH = 'false';

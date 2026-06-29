const mongoose = require('mongoose');
const { isRemoteProdUri, redactUri } = require('../../server/utils/dbSafety');

/**
 * Safe test-DB connection.
 *
 * tests/setup.js owns the shared in-memory MongoDB connection and brings it up in
 * a global beforeAll, so on the normal jest path mongoose is already connected by
 * the time a suite's own beforeAll runs — we just reuse it.
 *
 * If a suite is ever run in isolation (no global setup), we fall back to
 * MONGODB_URI — but ONLY if it is a safe local/test URI. A remote/Atlas URI is
 * REFUSED outright (throws) so a test can never connect to, seed, or deleteMany()
 * against the live production database. This is the defense that the previously
 * unguarded `mongoose.connect(process.env.MONGODB_URI || ...)` calls lacked.
 */
module.exports = async function connectTestDb() {
  if (mongoose.connection.readyState !== 0) return; // already connected by tests/setup.js
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click-test';
  if (isRemoteProdUri(uri)) {
    throw new Error(
      `[connectTestDb] Refusing to connect tests to a REMOTE database (${redactUri(uri)}). ` +
      `Tests must use an isolated local/in-memory DB (see tests/setup-env.js).`
    );
  }
  await mongoose.connect(uri);
};

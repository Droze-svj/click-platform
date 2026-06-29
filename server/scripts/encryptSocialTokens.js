/**
 * Idempotent, opt-in migration: encrypt SocialConnection OAuth tokens in place.
 *
 * Backward-compat note: this is NOT required for correctness. The model's
 * getter transparently decrypts encrypted tokens AND passes plaintext through,
 * so legacy plaintext tokens keep authenticating without ever running this.
 * Run this only if you want existing rows encrypted at rest immediately.
 *
 * Safe to run repeatedly: rows already in the `enc:v1:` form are skipped
 * (encryptToken is idempotent). Re-saving via the document setter encrypts any
 * plaintext accessToken/refreshToken. Requires ENCRYPTION_KEY to be set to the
 * SAME value the app uses, or encrypted rows won't decrypt at runtime.
 *
 * Usage:  ENCRYPTION_KEY=<hex> MONGODB_URI=<uri> node server/scripts/encryptSocialTokens.js
 *
 * This script is provided for operators; it is intentionally not wired into
 * boot and must be invoked manually.
 */

const mongoose = require('mongoose');
const SocialConnection = require('../models/SocialConnection');
const { isEncryptedToken } = require('../utils/dataEncryption');
const logger = require('../utils/logger');

async function run() {
  const uri = require('../utils/dbSafety').assertSafeScriptDbUri(process.env.MONGODB_URI || 'mongodb://localhost:27017/click', { allowProd: process.argv.includes('--prod'), scriptName: 'encryptSocialTokens' });
  await mongoose.connect(uri);

  let scanned = 0;
  let updated = 0;

  // Read RAW stored values (lean bypasses the getter) so we can detect which
  // rows still hold plaintext without decrypting/re-encrypting needlessly.
  const cursor = SocialConnection.find({}, { accessToken: 1, refreshToken: 1 }).lean().cursor();

  for (let row = await cursor.next(); row != null; row = await cursor.next()) {
    scanned += 1;
    const accessPlain = row.accessToken != null && !isEncryptedToken(row.accessToken);
    const refreshPlain = row.refreshToken != null && !isEncryptedToken(row.refreshToken);
    if (!accessPlain && !refreshPlain) continue;

    // Load the full hydrated doc and re-save so the setter encrypts the fields.
    const doc = await SocialConnection.findById(row._id);
    if (!doc) continue;
    // Reassign through the setter using the decrypted/plaintext getter value.
    // NOT a no-op: the field has a Mongoose getter (decrypts) + setter (encrypts),
    // so reading then re-assigning re-runs the setter, marks it modified, and save()
    // persists freshly-encrypted ciphertext. eslint can't see the setter side effect.
    // eslint-disable-next-line no-self-assign
    doc.accessToken = doc.accessToken;
    // eslint-disable-next-line no-self-assign
    if (doc.refreshToken != null) doc.refreshToken = doc.refreshToken;
    await doc.save();
    updated += 1;
  }

  logger.info('encryptSocialTokens migration complete', { scanned, updated });
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    logger.error('encryptSocialTokens migration failed', { error: err.message });
    process.exitCode = 1;
  });
}

module.exports = { run };

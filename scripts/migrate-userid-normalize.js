#!/usr/bin/env node
/**
 * migrate-userid-normalize.js
 *
 * Heals the identity fragmentation described in server/utils/userKey.js: some
 * historical writes keyed a user's Mongo documents by the Supabase UUID string
 * instead of the canonical deterministic ObjectId (the hex of ensureObjectId(uuid)).
 * That split a single user's data across TWO keys (e.g. prod `scheduledposts`
 * had 6 hex-form + 1 UUID-form userId). This converts every UUID-form userId to
 * its canonical hex form, so the orphaned documents rejoin the user's real key.
 *
 * SAFE BY DESIGN:
 *   - Operates on String-keyed collections ONLY, whose readers use the canonical
 *     hex id (req.user._id). It deliberately EXCLUDES UserSettings and UsageMeter,
 *     which are intentionally keyed by the Supabase UUID (their readers resolve
 *     identity UUID-first via getUserId) — normalizing those would orphan them.
 *   - Idempotent: a value already in hex form is left untouched, so re-running is
 *     a no-op. UUID-form → ensureObjectId(uuid).toString() (the SAME hex that
 *     user's req.user._id maps to).
 *   - DRY-RUN by default; --apply to write. Refuses a remote/prod DB unless run
 *     with NODE_ENV=production and an explicit --prod flag (dbSafety guard).
 *   - Pure string→string under the existing String schema: NO BSON type change,
 *     so there is no read-invisibility window and no deploy coordination needed.
 *
 *   node scripts/migrate-userid-normalize.js                                  # dry-run (local)
 *   NODE_ENV=production node scripts/migrate-userid-normalize.js --prod       # dry-run vs prod
 *   NODE_ENV=production node scripts/migrate-userid-normalize.js --prod --apply  # write
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { assertSafeScriptDbUri, redactUri } = require('../server/utils/dbSafety');
const { ensureObjectId } = require('../server/utils/devUser');

const APPLY = process.argv.includes('--apply');
const ALLOW_PROD = process.argv.includes('--prod') || process.argv.includes('--confirm-prod');

// Collections whose canonical key is the hex form of req.user._id. (NOT
// UserSettings / UsageMeter — those are intentionally UUID-keyed; see header.)
const COLLECTIONS = ['contents', 'scheduledposts', 'vectormemories', 'workflows', 'agenticjobs'];

/** Canonical hex form for a stored userId value, or null if it's already canonical/empty. */
function canonicalHexIfDifferent(value) {
  if (value == null) return null;
  // Only normalize STRING-stored ids. (A BSON ObjectId is already canonical.)
  if (typeof value !== 'string') return null;
  const oid = ensureObjectId(value);
  if (!oid) return null;
  const hex = oid.toString();
  return hex !== value ? hex : null;
}

async function main() {
  const uri = assertSafeScriptDbUri(process.env.MONGODB_URI || process.env.MONGO_URI, {
    allowProd: ALLOW_PROD,
    scriptName: 'migrate-userid-normalize',
  });
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`[userid-normalize] db=${redactUri(uri)} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const db = mongoose.connection.db;
  const totals = { scanned: 0, converted: 0 };

  for (const collName of COLLECTIONS) {
    const coll = db.collection(collName);
    let exists = true;
    try { await coll.estimatedDocumentCount(); } catch (_) { exists = false; }
    if (!exists) { console.log(`  - ${collName}: (absent, skipped)`); continue; }

    const cursor = coll.find({ userId: { $type: 'string' } }, { projection: { userId: 1 } });
    let scanned = 0;
    let converted = 0;
    const ops = [];
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      scanned += 1;
      const hex = canonicalHexIfDifferent(doc.userId);
      if (hex) {
        converted += 1;
        if (converted <= 10) console.log(`    ${collName}: ${doc.userId} → ${hex}`);
        ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { userId: hex } } } });
      }
    }
    totals.scanned += scanned;
    totals.converted += converted;
    console.log(`  - ${collName}: scanned ${scanned}, ${converted} UUID-form → hex`);
    if (APPLY && ops.length) {
      const res = await coll.bulkWrite(ops, { ordered: false });
      console.log(`    applied ${res.modifiedCount} updates to ${collName}`);
    }
  }

  console.log(`[userid-normalize] total scanned=${totals.scanned} convertible=${totals.converted} ${APPLY ? '(APPLIED)' : '(DRY-RUN)'}`);
  await mongoose.disconnect();
}

module.exports = { canonicalHexIfDifferent, COLLECTIONS };

if (require.main === module) {
  main().catch((err) => {
    console.error('[userid-normalize] ERROR:', err.message);
    process.exit(1);
  });
}

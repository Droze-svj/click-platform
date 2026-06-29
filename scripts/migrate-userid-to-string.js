#!/usr/bin/env node
/**
 * migrate-userid-to-string.js  — Phase 3 ROLLBACK (inverse) of the userId type flip.
 * See docs/userid-objectid-flip-runbook.md.
 *
 * Converts the BSON-ObjectId `userId` on the FLIP-SET collections BACK to its hex
 * String form. Run this if the ObjectId schema deploy has to be reverted: the
 * String schema casts a query ObjectId → hex string, so it only matches String-
 * stored data — meaning a rollback must revert BOTH the schema deploy AND the
 * data (this script), in the same maintenance step the forward cut-over used.
 *
 *   contents · scheduledposts · vectormemories · workflows · agenticjobs
 *
 * SAFE BY DESIGN:
 *   - Touches ONLY `userId: { $type: 'objectId' }`; values already String are
 *     skipped → idempotent, re-run is a no-op.
 *   - `oid.toString()` yields the exact canonical hex req.user._id maps to, so
 *     the data lands back on the key the String-schema readers expect.
 *   - DRY-RUN by default; --apply to write. Refuses a remote/prod DB unless
 *     NODE_ENV=production AND an explicit --prod flag (dbSafety guard).
 *
 *   node scripts/migrate-userid-to-string.js                                    # dry-run (local)
 *   NODE_ENV=production node scripts/migrate-userid-to-string.js --prod         # dry-run vs prod
 *   NODE_ENV=production node scripts/migrate-userid-to-string.js --prod --apply # write (rollback)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { assertSafeScriptDbUri, redactUri } = require('../server/utils/dbSafety');

const COLLECTIONS = ['contents', 'scheduledposts', 'vectormemories', 'workflows', 'agenticjobs'];

/**
 * Convert BSON ObjectId userId → hex String across the flip-set collections.
 * @param {import('mongodb').Db} db  a live driver Db handle
 * @param {{apply?: boolean, log?: Function}} opts
 */
async function convertToString(db, { apply = false, log = () => {} } = {}) {
  const totals = { objectIdTyped: 0, converted: 0 };

  for (const collName of COLLECTIONS) {
    const coll = db.collection(collName);
    let exists = true;
    try { await coll.estimatedDocumentCount(); } catch (_) { exists = false; }
    if (!exists) { log(`  - ${collName}: (absent, skipped)`); continue; }

    const cursor = coll.find({ userId: { $type: 'objectId' } }, { projection: { userId: 1 } });
    let objectIdTyped = 0;
    const ops = [];
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      objectIdTyped += 1;
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { userId: doc.userId.toString() } } } });
    }
    totals.objectIdTyped += objectIdTyped;
    totals.converted += ops.length;
    log(`  - ${collName}: objectId-typed ${objectIdTyped} → hex string`);
    if (apply && ops.length) {
      const res = await coll.bulkWrite(ops, { ordered: false });
      log(`    applied ${res.modifiedCount} string conversions to ${collName}`);
    }
  }
  return { totals };
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const ALLOW_PROD = process.argv.includes('--prod') || process.argv.includes('--confirm-prod');
  const uri = assertSafeScriptDbUri(process.env.MONGODB_URI || process.env.MONGO_URI, {
    allowProd: ALLOW_PROD,
    scriptName: 'migrate-userid-to-string',
  });
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`[userid→string] db=${redactUri(uri)} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const { totals } = await convertToString(mongoose.connection.db, { apply: APPLY, log: console.log });
  console.log(`[userid→string] total objectId-typed=${totals.objectIdTyped} converted=${totals.converted} ${APPLY ? '(APPLIED)' : '(DRY-RUN)'}`);
  await mongoose.disconnect();
}

module.exports = { COLLECTIONS, convertToString };

if (require.main === module) {
  main().catch((err) => {
    console.error('[userid→string] ERROR:', err.message);
    process.exit(1);
  });
}

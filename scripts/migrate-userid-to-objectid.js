#!/usr/bin/env node
/**
 * migrate-userid-to-objectid.js  — Phase 3 (FORWARD) of the userId type flip.
 * See docs/userid-objectid-flip-runbook.md.
 *
 * Converts the String-stored `userId` on the FLIP-SET collections to a BSON
 * ObjectId, in lockstep with deploying the ObjectId schema on those 5 models.
 * Run AFTER Phase 2 (migrate-userid-normalize) reports 0 convertible, so every
 * stored value is already canonical 24-hex == the hex of req.user._id.
 *
 *   contents · scheduledposts · vectormemories · workflows · agenticjobs
 *
 * SAFE BY DESIGN:
 *   - Touches ONLY `userId: { $type: 'string' }`; values already ObjectId are
 *     skipped → idempotent, re-run is a no-op.
 *   - PRE-FLIGHT GUARD: if ANY string userId is not 24-hex (a UUID that escaped
 *     Phase 2), it ABORTS without writing and tells you to run Phase 2 first —
 *     converting only the hex ones would split the collection across two types.
 *   - DRY-RUN by default; --apply to write. Refuses a remote/prod DB unless
 *     NODE_ENV=production AND an explicit --prod flag (dbSafety guard).
 *
 * READ-INVISIBILITY WINDOW: while the schema says ObjectId but data is still
 * String (or vice-versa) reads return nothing. Keep this apply + the schema-flip
 * deploy inside ONE short maintenance step. Have migrate-userid-to-string.js
 * (the inverse) ready as rollback.
 *
 *   node scripts/migrate-userid-to-objectid.js                                    # dry-run (local)
 *   NODE_ENV=production node scripts/migrate-userid-to-objectid.js --prod         # dry-run vs prod
 *   NODE_ENV=production node scripts/migrate-userid-to-objectid.js --prod --apply # write (maintenance window)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { assertSafeScriptDbUri, redactUri } = require('../server/utils/dbSafety');

const COLLECTIONS = ['contents', 'scheduledposts', 'vectormemories', 'workflows', 'agenticjobs'];
const HEX24 = /^[a-f0-9]{24}$/i;

/**
 * Convert String userId → BSON ObjectId across the flip-set collections.
 * @param {import('mongodb').Db} db  a live driver Db handle
 * @param {{apply?: boolean, log?: Function}} opts
 * @returns {{totals: {stringTyped:number,convertible:number,nonHex:number}, aborted: boolean}}
 *   `aborted` is true (and NO writes happen) when any non-hex string is found.
 */
async function convertToObjectId(db, { apply = false, log = () => {} } = {}) {
  const totals = { stringTyped: 0, convertible: 0, nonHex: 0 };
  const plan = [];

  for (const collName of COLLECTIONS) {
    const coll = db.collection(collName);
    let exists = true;
    try { await coll.estimatedDocumentCount(); } catch (_) { exists = false; }
    if (!exists) { log(`  - ${collName}: (absent, skipped)`); continue; }

    const cursor = coll.find({ userId: { $type: 'string' } }, { projection: { userId: 1 } });
    let stringTyped = 0;
    let nonHex = 0;
    const ops = [];
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      stringTyped += 1;
      if (!HEX24.test(doc.userId)) {
        nonHex += 1;
        if (nonHex <= 5) log(`    !! ${collName}: non-hex userId ${JSON.stringify(doc.userId)} (run Phase 2 normalize first)`);
        continue;
      }
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { userId: new mongoose.Types.ObjectId(doc.userId) } } } });
    }
    totals.stringTyped += stringTyped;
    totals.convertible += ops.length;
    totals.nonHex += nonHex;
    log(`  - ${collName}: string-typed ${stringTyped}, convertible ${ops.length}${nonHex ? `, NON-HEX ${nonHex}` : ''}`);
    plan.push({ coll, collName, ops });
  }

  if (totals.nonHex > 0) {
    log(`[userid→objectid] ABORT: ${totals.nonHex} non-hex string userId(s) found. Run scripts/migrate-userid-normalize.js --apply first, then re-run this.`);
    return { totals, aborted: true };
  }

  if (apply) {
    for (const { coll, collName, ops } of plan) {
      if (!ops.length) continue;
      const res = await coll.bulkWrite(ops, { ordered: false });
      log(`    applied ${res.modifiedCount} ObjectId conversions to ${collName}`);
    }
  }
  return { totals, aborted: false };
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const ALLOW_PROD = process.argv.includes('--prod') || process.argv.includes('--confirm-prod');
  const uri = assertSafeScriptDbUri(process.env.MONGODB_URI || process.env.MONGO_URI, {
    allowProd: ALLOW_PROD,
    scriptName: 'migrate-userid-to-objectid',
  });
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`[userid→objectid] db=${redactUri(uri)} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const { totals, aborted } = await convertToObjectId(mongoose.connection.db, { apply: APPLY, log: console.log });
  console.log(`[userid→objectid] total string-typed=${totals.stringTyped} convertible=${totals.convertible} ${APPLY ? '(APPLIED)' : '(DRY-RUN)'}`);
  await mongoose.disconnect();
  if (aborted) process.exit(2);
}

module.exports = { COLLECTIONS, HEX24, convertToObjectId };

if (require.main === module) {
  main().catch((err) => {
    console.error('[userid→objectid] ERROR:', err.message);
    process.exit(1);
  });
}

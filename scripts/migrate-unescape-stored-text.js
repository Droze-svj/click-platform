#!/usr/bin/env node
/**
 * migrate-unescape-stored-text.js
 *
 * From 2026-06-09 to 2026-10-24 the global input sanitizer HTML-escaped every
 * request body string before routes saved it, so user text was stored as
 * `Tom&#x27;s tips &amp; tricks` and URLs as `https:&#x2F;&#x2F;…`. Input is no
 * longer escaped; this decodes what was stored in that window so titles,
 * captions, scripts and names display (and publish) as typed.
 *
 * SAFE BY DESIGN:
 *   - Only string values containing one of the exact entities validator.escape()
 *     produces (&amp; &lt; &gt; &quot; &#x27; &#x2F; &#x5C; &#96;) are touched,
 *     decoded with validator.unescape — the exact inverse.
 *   - Never touches secrets/credentials: any path whose key matches
 *     password|token|secret|hash|apiKey|accessToken|refreshToken|key$ is skipped,
 *     as are the `oauth` sub-documents.
 *   - Idempotent: decoded text no longer matches, so re-running is a no-op.
 *     (Text a user deliberately typed as "&amp;" would be decoded once — an
 *     accepted, cosmetic edge case.)
 *   - DRY-RUN by default; --apply to write. Refuses a remote/prod DB unless run
 *     with NODE_ENV=production and --prod (dbSafety guard).
 *
 *   node scripts/migrate-unescape-stored-text.js                                   # dry-run (local)
 *   NODE_ENV=production node scripts/migrate-unescape-stored-text.js --prod        # dry-run vs prod
 *   NODE_ENV=production node scripts/migrate-unescape-stored-text.js --prod --apply  # write
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { unescape: decodeEntities } = require('validator');
const { assertSafeScriptDbUri, redactUri } = require('../server/utils/dbSafety');

const APPLY = process.argv.includes('--apply');
const ALLOW_PROD = process.argv.includes('--prod') || process.argv.includes('--confirm-prod');

// Collections holding user-entered text.
const COLLECTIONS = [
  'users', 'contents', 'scheduledposts', 'scripts', 'blogposts', 'teams', 'drafts',
  'contenttemplates', 'comments', 'postcomments', 'inlinecomments', 'workflows',
  'tasks', 'projects', 'notifications', 'contentapprovals', 'approvalrequests',
  'brandkits', 'usersettings', 'savedexports', 'recurringposttemplates',
];

const ENTITY = /&(amp|lt|gt|quot|#x27|#x2F|#x5C|#96);/;
const SECRET_KEY = /(password|token|secret|hash|apikey|accesstoken|refreshtoken|key)$/i;

/** Returns { value, changes } with entity-escaped strings decoded. */
function decodeDeep(value, key = '', depth = 0) {
  if (depth > 20) return { value, changes: 0 };
  if (typeof value === 'string') {
    if (SECRET_KEY.test(key) || !ENTITY.test(value)) return { value, changes: 0 };
    const decoded = decodeEntities(value);
    return decoded === value ? { value, changes: 0 } : { value: decoded, changes: 1 };
  }
  if (Array.isArray(value)) {
    let changes = 0;
    const out = value.map((v) => { const r = decodeDeep(v, key, depth + 1); changes += r.changes; return r.value; });
    return { value: out, changes };
  }
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId) && !Buffer.isBuffer(value) && value._bsontype === undefined) {
    let changes = 0;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'oauth' || k === '_id') { out[k] = v; continue; }
      const r = decodeDeep(v, k, depth + 1);
      changes += r.changes;
      out[k] = r.value;
    }
    return { value: out, changes };
  }
  return { value, changes: 0 };
}

async function main() {
  const uri = assertSafeScriptDbUri(process.env.MONGODB_URI || process.env.MONGO_URI, {
    allowProd: ALLOW_PROD,
    scriptName: 'migrate-unescape-stored-text',
  });
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`[unescape-text] db=${redactUri(uri)} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const db = mongoose.connection.db;
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  let totalDocs = 0;
  let totalStrings = 0;
  for (const name of COLLECTIONS) {
    if (!existing.has(name)) continue;
    const coll = db.collection(name);
    let docs = 0;
    let strings = 0;
    const cursor = coll.find({});
    for await (const doc of cursor) {
      const sets = {};
      for (const [k, v] of Object.entries(doc)) {
        if (k === '_id' || k === 'oauth' || SECRET_KEY.test(k)) continue;
        const r = decodeDeep(v, k);
        if (r.changes) { sets[k] = r.value; strings += r.changes; }
      }
      if (Object.keys(sets).length) {
        docs += 1;
        if (APPLY) await coll.updateOne({ _id: doc._id }, { $set: sets });
      }
    }
    if (docs) console.log(`  ${name}: ${docs} document(s), ${strings} string(s)${APPLY ? ' decoded' : ' would be decoded'}`);
    totalDocs += docs;
    totalStrings += strings;
  }
  console.log(`[unescape-text] ${totalDocs} document(s), ${totalStrings} string(s) ${APPLY ? 'decoded' : 'to decode (dry-run; pass --apply to write)'}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => { console.error('[unescape-text] failed:', err.message); process.exit(1); });
}

module.exports = { decodeDeep };

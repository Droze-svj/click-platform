#!/usr/bin/env node
/**
 * purge-orphaned-deadletters.js
 *
 * One-time cleanup of the orphaned `content-generation` dead-letter jobs that
 * accumulated when dev/E2E test runs hit the production DB (Content created then
 * wiped by test teardown → the async worker's `Content.findById` throws
 * "Content not found" → all retries fail → dead-letter). Those jobs belong to
 * test accounts only; there are no real-user failures. (A 90-day TTL index would
 * eventually expire them; this purges them now.)
 *
 * SAFE BY DESIGN:
 *   - DRY-RUN by default: prints the matching docs and writes nothing.
 *   - Targets ONLY content-generation dead-letters whose failedReason matches
 *     "Content not found" and that were never retried.
 *   - Refuses to touch a remote/prod DB unless run with NODE_ENV=production AND
 *     an explicit --prod flag (the dbSafety guard).
 *
 *   node scripts/purge-orphaned-deadletters.js                          # dry-run (local)
 *   NODE_ENV=production node scripts/purge-orphaned-deadletters.js --prod          # dry-run against prod
 *   NODE_ENV=production node scripts/purge-orphaned-deadletters.js --prod --apply  # actually delete
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { assertSafeScriptDbUri, redactUri } = require('../server/utils/dbSafety');
const DeadLetterJob = require('../server/models/DeadLetterJob');

const APPLY = process.argv.includes('--apply');
const ALLOW_PROD = process.argv.includes('--prod') || process.argv.includes('--confirm-prod');

const FILTER = {
  originalQueueName: 'content-generation',
  failedReason: /Content not found/i,
  retried: { $ne: true },
};

async function main() {
  const uri = assertSafeScriptDbUri(process.env.MONGODB_URI || process.env.MONGO_URI, {
    allowProd: ALLOW_PROD,
    scriptName: 'purge-orphaned-deadletters',
  });
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`[purge-deadletters] db=${redactUri(uri)} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const matches = await DeadLetterJob.find(FILTER)
    .select('originalJobId jobName failedReason movedAt jobData.userId')
    .lean();

  console.log(`[purge-deadletters] matched ${matches.length} orphaned content-generation dead-letter(s).`);
  for (const m of matches.slice(0, 20)) {
    console.log(`  - ${m.originalJobId} | ${m.jobName} | uid=${m.jobData?.userId || '?'} | ${m.failedReason?.slice(0, 60)}`);
  }
  if (matches.length > 20) console.log(`  …and ${matches.length - 20} more`);

  if (!APPLY) {
    console.log('[purge-deadletters] DRY-RUN — nothing deleted. Re-run with --apply (and --prod for prod) to delete.');
  } else {
    const res = await DeadLetterJob.deleteMany(FILTER);
    console.log(`[purge-deadletters] deleted ${res.deletedCount} dead-letter doc(s).`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[purge-deadletters] ERROR:', err.message);
  process.exit(1);
});

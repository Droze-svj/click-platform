#!/usr/bin/env node
/**
 * migrate-captions-off-content.js
 *
 * Backfills the new `Caption` collection from the legacy embedded
 * Content.captions.{text,segments,words,formatted,translations}, so caption data
 * no longer risks the 16MB BSON limit on the Content document.
 *
 * SAFE BY DESIGN:
 *   - DRY-RUN by default: prints what it WOULD do and writes nothing. Pass
 *     `--apply` to actually upsert Caption documents.
 *   - Idempotent + resumable: re-running upserts the same (contentId, language)
 *     docs, so a partial run can be safely repeated.
 *   - The embedded heavy fields are only removed with `--cleanup` (a SEPARATE,
 *     later phase) — so you migrate first, verify reads, THEN reclaim the space.
 *
 *   node scripts/migrate-captions-off-content.js            # dry-run
 *   node scripts/migrate-captions-off-content.js --apply    # write Caption docs
 *   node scripts/migrate-captions-off-content.js --apply --cleanup  # + $unset embedded heavy fields
 *
 * ⚠️  This uses MONGODB_URI from your environment — which is the LIVE database.
 *     Take a backup and run --apply first, confirm the app reads correctly via
 *     captionStore, and only then run --cleanup.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { assertSafeScriptDbUri } = require('../server/utils/dbSafety');
const Content = require('../server/models/Content');
const Caption = require('../server/models/Caption');
const captionStore = require('../server/services/captionStore');

const APPLY = process.argv.includes('--apply');
const CLEANUP = process.argv.includes('--cleanup');
// This migration intentionally targets the LIVE prod DB — require an explicit
// acknowledgement (--prod) or NODE_ENV=production so it can't run by accident.
const ALLOW_PROD = process.argv.includes('--prod') || process.argv.includes('--confirm-prod');

async function main() {
  const uri = assertSafeScriptDbUri(process.env.MONGODB_URI || process.env.MONGO_URI, {
    allowProd: ALLOW_PROD,
    scriptName: 'migrate-captions-off-content',
  });
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`[migrate-captions] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} cleanup=${CLEANUP}`);

  const cursor = Content.find({ 'captions.text': { $exists: true, $ne: '' } })
    .select('captions')
    .cursor();

  const stats = { scanned: 0, sources: 0, translations: 0, cleaned: 0, errors: 0 };
  for (let c = await cursor.next(); c != null; c = await cursor.next()) {
    stats.scanned += 1;
    const emb = c.captions;
    if (!emb || !emb.text) continue;
    const lang = String(emb.language || 'en').toLowerCase();
    try {
      if (APPLY) {
        await captionStore.saveSource(c._id, {
          language: lang,
          text: emb.text,
          format: emb.format,
          segments: emb.segments,
          words: emb.words,
          formatted: emb.formatted,
          generatedAt: emb.generatedAt,
        });
      }
      stats.sources += 1;

      const tmap = (emb.translations && typeof emb.translations === 'object') ? emb.translations : {};
      for (const [tlang, t] of Object.entries(tmap)) {
        if (!t || !t.text) continue;
        if (APPLY) {
          await captionStore.saveTranslation(c._id, tlang, {
            text: t.text,
            segments: t.segments,
            formatted: t.formatted,
            format: t.format,
            translatedAt: t.translatedAt,
          });
        }
        stats.translations += 1;
      }

      if (APPLY && CLEANUP) {
        await Content.updateOne(
          { _id: c._id },
          { $unset: { 'captions.words': '', 'captions.segments': '', 'captions.formatted': '', 'captions.translations': '' } },
        );
        stats.cleaned += 1;
      }
    } catch (e) {
      stats.errors += 1;
      console.error(`[migrate-captions] error on content ${c._id}: ${e.message}`);
    }
  }

  console.log('[migrate-captions] done', stats);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * Locale backfill — translates every English key that's missing (or empty)
 * in each non-English locale dictionary, using Gemini via the existing
 * server/utils/googleAI helper. Designed to be safe to re-run: keys already
 * present in the target locale are left untouched, so this also fills only
 * the gaps introduced by new feature work.
 *
 * Usage:
 *   node scripts/backfill-locales.js               # all non-English locales
 *   node scripts/backfill-locales.js de fr ar      # only these locales
 *   DRY_RUN=true node scripts/backfill-locales.js  # don't write files
 *
 * The script writes results to BOTH client/i18n/locales/<code>.json (source)
 * and client/public/i18n/locales/<code>.json (Next.js public asset) so the
 * runtime fetcher and the source-tree stay in sync.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'client/i18n/locales');
const PUB_DIR = path.join(ROOT, 'client/public/i18n/locales');

// Codes to fill. Keep in sync with client/i18n/config.ts.
const ALL_LOCALES = ['es','fr','de','pt','it','ja','ko','zh-Hans','ar','hi','ru','tr','id','vi','pl','nl','th'];

// Human-readable label for each target language, matching the aiLanguageLabel
// map in client/i18n/config.ts so the Gemini prompt produces region-correct
// output (e.g. neutral LATAM Spanish, not Castilian).
const LANG_LABEL = {
  'es':      'Spanish (neutral LATAM register)',
  'fr':      'French',
  'de':      'German',
  'pt':      'Brazilian Portuguese',
  'it':      'Italian',
  'ja':      'Japanese',
  'ko':      'Korean',
  'zh-Hans': 'Simplified Chinese',
  'ar':      'Modern Standard Arabic',
  'hi':      'Hindi (keep tech terms in Latin script)',
  'ru':      'Russian',
  'tr':      'Turkish (casual creator voice)',
  'id':      'Bahasa Indonesia (spoken register, English loanwords for tech OK)',
  'vi':      'Vietnamese (Northern register, preserve diacritics)',
  'pl':      'Polish (informal "ty" register)',
  'nl':      'Dutch (Netherlands register, "je" form)',
  'th':      'Thai (informal register)',
};

const BATCH_SIZE = 20; // keys per Gemini call. Translated output can be
                       // ~2x the English source for verbose languages
                       // (Spanish, Portuguese), so keep this conservative
                       // even with maxTokens raised.
const DRY_RUN = process.env.DRY_RUN === 'true';

// Flatten { a: { b: 'c' } } → { 'a.b': 'c' }. Keeps the nested shape on the
// way out so we never accidentally rewrite a key as a string when the source
// has it as a nested object.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, next, out);
    else if (typeof v === 'string') out[next] = v;
  }
  return out;
}

function unflatten(flat) {
  const out = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

async function translateBatch(generateContent, targetLabel, pairs) {
  // Ask Gemini to return a JSON map keyed by the same identifiers. Forcing
  // a JSON-only response gets us a deterministic shape that we can parse
  // without scraping prose.
  const dict = Object.fromEntries(pairs);
  const prompt = `You are a senior product localization translator. Translate the values of the JSON object below from English into ${targetLabel}.

Rules:
- Return ONLY the JSON object. No prose, no markdown, no code fences.
- Keep the exact same keys.
- Preserve any placeholders like {name}, {count}, <b>, \\n, leading/trailing spaces.
- Preserve emoji and casing of brand/product names.
- Be concise — UI strings, not paragraphs. Prefer the natural creator voice for that language.
- Do not translate words like "Click" (this is the product name), "TikTok", "Instagram", "YouTube", "X", "LinkedIn", "Facebook", "AI", "API", "URL", "OAuth".

Input:
${JSON.stringify(dict, null, 2)}

Translated JSON:`;

  // googleAI.generateContent reads `maxTokens` (mapped to maxOutputTokens
  // internally). Earlier passes used the SDK-level key and got truncated.
  const raw = await generateContent(prompt, { temperature: 0.2, maxTokens: 8192 });
  if (!raw) throw new Error('Empty response from Gemini');

  // Strip code-fence wrapping if Gemini added one despite the instruction.
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Last-ditch: take the substring between the first { and last }.
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first === -1 || last === -1) throw new Error(`Gemini returned non-JSON: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(cleaned.slice(first, last + 1));
  }
  return parsed;
}

async function backfillLocale(locale, enFlat, generateContent) {
  const srcPath = path.join(SRC_DIR, `${locale}.json`);
  const pubPath = path.join(PUB_DIR, `${locale}.json`);
  const existing = fs.existsSync(pubPath)
    ? JSON.parse(fs.readFileSync(pubPath, 'utf8'))
    : (fs.existsSync(srcPath) ? JSON.parse(fs.readFileSync(srcPath, 'utf8')) : {});
  const existingFlat = flatten(existing);

  // Find missing or empty keys.
  const missing = [];
  for (const [k, v] of Object.entries(enFlat)) {
    const cur = existingFlat[k];
    if (cur === undefined || cur === null || (typeof cur === 'string' && cur.trim() === '')) {
      missing.push([k, v]);
    }
  }

  if (missing.length === 0) {
    console.log(`  ${locale}: complete (no missing keys)`);
    return { locale, added: 0, total: Object.keys(enFlat).length };
  }

  console.log(`  ${locale}: ${missing.length} missing — translating in batches of ${BATCH_SIZE}`);
  const label = LANG_LABEL[locale];
  let added = 0;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    try {
      const translated = await translateBatch(generateContent, label, batch);
      for (const [k] of batch) {
        const t = translated[k];
        if (typeof t === 'string' && t.trim().length > 0) {
          existingFlat[k] = t;
          added++;
        }
      }
      const done = Math.min(i + BATCH_SIZE, missing.length);
      process.stdout.write(`    [${done}/${missing.length}] `);
    } catch (err) {
      console.error(`\n    Batch ${i / BATCH_SIZE} failed: ${err.message}`);
    }
  }
  console.log('done');

  if (DRY_RUN) {
    console.log(`  ${locale}: DRY_RUN — not writing files (${added} translations skipped)`);
    return { locale, added, total: Object.keys(enFlat).length };
  }

  const merged = unflatten(existingFlat);
  const payload = JSON.stringify(merged, null, 2) + '\n';
  fs.writeFileSync(srcPath, payload);
  fs.writeFileSync(pubPath, payload);
  console.log(`  ${locale}: wrote ${added} new translations to ${path.relative(ROOT, srcPath)} + ${path.relative(ROOT, pubPath)}`);
  return { locale, added, total: Object.keys(enFlat).length };
}

async function main() {
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('GOOGLE_AI_API_KEY is required in .env');
    process.exit(1);
  }

  const { generateContent, isConfigured } = require('../server/utils/googleAI');
  if (!isConfigured) {
    console.error('googleAI utility reports not configured');
    process.exit(1);
  }

  const enPath = path.join(PUB_DIR, 'en.json');
  if (!fs.existsSync(enPath)) {
    console.error(`Source dictionary missing: ${enPath}`);
    process.exit(1);
  }
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const enFlat = flatten(en);
  console.log(`Source en.json: ${Object.keys(enFlat).length} keys`);

  const requested = process.argv.slice(2).filter(Boolean);
  const locales = requested.length > 0
    ? requested.filter((l) => ALL_LOCALES.includes(l))
    : ALL_LOCALES;
  if (locales.length === 0) {
    console.error(`No valid locales. Choose from: ${ALL_LOCALES.join(', ')}`);
    process.exit(1);
  }

  console.log(`Backfilling ${locales.length} locale${locales.length === 1 ? '' : 's'}: ${locales.join(', ')}${DRY_RUN ? ' (DRY RUN)' : ''}`);
  const results = [];
  for (const l of locales) {
    try {
      const r = await backfillLocale(l, enFlat, generateContent);
      results.push(r);
    } catch (err) {
      console.error(`  ${l}: FAILED — ${err.message}`);
      results.push({ locale: l, added: 0, error: err.message });
    }
  }

  console.log('\nSummary:');
  for (const r of results) {
    const pct = r.total ? Math.round(((Object.keys(flatten(JSON.parse(fs.readFileSync(path.join(PUB_DIR, `${r.locale}.json`), 'utf8')))).length) / r.total) * 100) : 0;
    console.log(`  ${r.locale}: +${r.added} added, ~${pct}% coverage`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

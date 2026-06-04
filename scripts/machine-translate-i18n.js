#!/usr/bin/env node
/**
 * Machine-translate the i18n locale catalogs to parity with en.json.
 *
 * For every non-English locale, any leaf key that is MISSING or still equals the
 * English string (i.e. untranslated) is machine-translated from en.json. Already
 * translated values are preserved. Interpolation tokens ({{var}}) are protected
 * across translation so they survive intact.
 *
 * No external dependency: uses the free Google translate endpoint over https,
 * throttled, with retry + English fallback so a transient failure never corrupts
 * a catalog (it just leaves that key in English to be retried next run).
 *
 *   node scripts/machine-translate-i18n.js                # all locales
 *   node scripts/machine-translate-i18n.js es fr de       # only these
 *   node scripts/machine-translate-i18n.js --dry-run      # report, no writes
 *
 * Output is machine-quality (no human review) — by design.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const LOCALES_DIR = path.join(__dirname, '..', 'client', 'public', 'i18n', 'locales');
const THROTTLE_MS = 120;
const MAX_RETRIES = 3;

// Map our locale codes to Google translate target codes.
const GOOGLE_CODE = { 'zh-Hans': 'zh-CN' };

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const onlyLocales = args.filter((a) => !a.startsWith('--'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function flatten(obj, prefix = '') {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const kk = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, kk));
    else out[kk] = v;
  }
  return out;
}
function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// Protect {{interpolation}} tokens (and bare URLs) from the translator.
function protect(text) {
  const tokens = [];
  const masked = text.replace(/\{\{[^}]+\}\}/g, (m) => {
    tokens.push(m);
    return `￹${tokens.length - 1}￺`;
  });
  return { masked, tokens };
}
function restore(text, tokens) {
  return text.replace(/￹(\d+)￺/g, (_, i) => tokens[Number(i)] ?? '');
}

function googleTranslate(text, target) {
  return new Promise((resolve, reject) => {
    const tl = GOOGLE_CODE[target] || target;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try {
          const json = JSON.parse(data);
          const out = (json[0] || []).map((seg) => seg[0]).join('');
          resolve(out || text);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function translateWithRetry(text, target) {
  const { masked, tokens } = protect(text);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const out = await googleTranslate(masked, target);
      return restore(out, tokens);
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.warn(`   ! translate failed (${target}) after ${MAX_RETRIES} tries — keeping English: ${err.message}`);
        return text; // English fallback
      }
      await sleep(THROTTLE_MS * attempt * 3);
    }
  }
  return text;
}

(async () => {
  const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
  const enFlat = flatten(en);
  const enKeys = Object.keys(enFlat);

  const localeFiles = fs.readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'en.json')
    .map((f) => f.replace('.json', ''))
    .filter((code) => (onlyLocales.length ? onlyLocales.includes(code) : true));

  let grandTotal = 0;
  for (const code of localeFiles) {
    const file = path.join(LOCALES_DIR, `${code}.json`);
    const locale = JSON.parse(fs.readFileSync(file, 'utf8'));
    const locFlat = flatten(locale);

    // Keys needing translation: missing, or still equal to English (and the
    // English value is actually translatable text, not empty/number).
    const todo = enKeys.filter((k) => {
      const ev = enFlat[k];
      if (typeof ev !== 'string' || !ev.trim()) return false;
      const lv = locFlat[k];
      return lv === undefined || lv === ev;
    });

    if (!todo.length) { console.log(`${code}: already complete`); continue; }
    console.log(`${code}: translating ${todo.length} keys${DRY_RUN ? ' (dry-run)' : ''}...`);
    if (DRY_RUN) { grandTotal += todo.length; continue; }

    let done = 0;
    for (const k of todo) {
      const translated = await translateWithRetry(enFlat[k], code);
      setPath(locale, k, translated);
      done++;
      grandTotal++;
      if (done % 25 === 0) console.log(`   ${code}: ${done}/${todo.length}`);
      await sleep(THROTTLE_MS);
    }
    fs.writeFileSync(file, JSON.stringify(locale, null, 2) + '\n');
    console.log(`   ${code}: wrote ${done} translations`);
  }
  console.log(`\nDone. ${grandTotal} keys ${DRY_RUN ? 'would be' : ''} translated across ${localeFiles.length} locales.`);
})();

/**
 * language.js — server-side language detection middleware.
 *
 * Reads (in priority order):
 *   1. Explicit `?lang=es` query param (used by API debugging tools)
 *   2. `X-Click-Language` request header (set by the web client when the user
 *      changes language so we don't have to wait for them to update their
 *      browser's Accept-Language)
 *   3. `Accept-Language` header (browser default)
 *   4. `defaultLanguage`
 *
 * Mounted globally so every downstream route gets `req.language` and can
 * forward it to AI prompt builders.
 */

const SUPPORTED = [
  'en', 'es', 'fr', 'de', 'pt', 'it',
  'ja', 'ko', 'zh-Hans', 'ar', 'hi', 'ru',
  // 2026 expansion — keep in sync with client/i18n/config.ts.
  // Adding a language here without a matching entry in AI_LABELS is a
  // quiet bug: the route falls through to English even when the dropdown
  // says Turkish.
  'tr', 'id', 'vi', 'pl', 'nl', 'th',
];
const DEFAULT = 'en';

const AI_LABELS = {
  'en':      'English',
  'es':      'Spanish (neutral LATAM unless niche signals Spain-specific)',
  'fr':      'French',
  'de':      'German',
  'pt':      'Brazilian Portuguese (use European Portuguese only if user signal suggests it)',
  'it':      'Italian',
  'ja':      'Japanese',
  'ko':      'Korean',
  'zh-Hans': 'Simplified Chinese',
  'ar':      'Modern Standard Arabic',
  'hi':      'Hindi (use Latin transliteration for hashtags only)',
  'ru':      'Russian',
  'tr':      'Turkish (Istanbul register, casual creator voice)',
  'id':      'Bahasa Indonesia (everyday spoken register, English loanwords for tech)',
  'vi':      'Vietnamese (Northern register, preserve diacritics, English loanwords for tech)',
  'pl':      'Polish (informal "ty" register, respect grammatical case)',
  'nl':      'Dutch (Netherlands register, "je" form for casual creator voice)',
  'th':      'Thai (informal register, preserve tonal accuracy in word choice)',
};

function normalize(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT;
  const lower = raw.toLowerCase().trim();
  if (SUPPORTED.includes(lower)) return lower;
  // Region-stripped match
  const base = lower.split('-')[0];
  if (base === 'zh') return 'zh-Hans';
  for (const code of SUPPORTED) {
    if (code.toLowerCase().startsWith(base)) return code;
  }
  return DEFAULT;
}

function parseAcceptLanguage(header) {
  // "en-US,en;q=0.9,es;q=0.8" → first valid match by quality
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(',').map(p => {
    const [tag, ...rest] = p.trim().split(';');
    const q = rest.find(r => r.trim().startsWith('q=')) || 'q=1';
    return { tag: tag.toLowerCase(), q: parseFloat(q.split('=')[1]) || 1 };
  }).sort((a, b) => b.q - a.q);
  for (const p of parts) {
    const norm = normalize(p.tag);
    if (norm !== DEFAULT || p.tag === 'en' || p.tag.startsWith('en-')) return norm;
  }
  return null;
}

function languageMiddleware(req, _res, next) {
  let lang = null;
  if (req.query && req.query.lang) lang = normalize(String(req.query.lang));
  if (!lang && req.headers['x-click-language']) lang = normalize(String(req.headers['x-click-language']));
  if (!lang) lang = parseAcceptLanguage(req.headers['accept-language']);
  if (!lang) lang = DEFAULT;
  req.language = lang;
  req.languageLabel = AI_LABELS[lang] || AI_LABELS[DEFAULT];
  next();
}

languageMiddleware.SUPPORTED = SUPPORTED;
languageMiddleware.DEFAULT = DEFAULT;
languageMiddleware.AI_LABELS = AI_LABELS;
languageMiddleware.normalize = normalize;

module.exports = languageMiddleware;

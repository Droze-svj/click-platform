// captionStore — the single read/write path for video captions/transcripts.
//
// Captions used to be embedded on the Content document (captions.words /
// captions.segments / captions.translations), which could push a long or
// multi-language video toward the 16MB BSON limit. They now live in their own
// `Caption` collection (one doc per content+language, see models/Caption.js).
//
// This module is intentionally BACKWARD COMPATIBLE: every read falls back to the
// legacy embedded Content.captions when no Caption document exists, so content
// that hasn't been migrated keeps working with zero downtime. Writes store the
// heavy fields in the collection and keep only a SLIM marker
// (text/language/format/generatedAt) embedded — so newly-captioned Content stays
// small immediately, and scripts/migrate-captions-off-content.js backfills the
// rest later.

const Content = require('../models/Content');
const Caption = require('../models/Caption');
const logger = require('../utils/logger');

const mongoose = require('mongoose');

const lc = (s) => String(s == null ? '' : s).toLowerCase().trim();

// Dev-store IDs ('dev-content-…') and any non-ObjectId aren't in the Caption
// collection — skip the query (which would throw a CastError) and use the
// embedded fallback instead.
const isQueryableId = (id) => {
  try { return mongoose.Types.ObjectId.isValid(id); } catch (_) { return false; }
};
async function safeFindOne(filter) {
  try { return await Caption.findOne(filter).lean(); } catch (_) { return null; }
}
async function safeExists(filter) {
  try { return await Caption.exists(filter); } catch (_) { return null; }
}

async function loadContent(contentId, content) {
  if (content) return content;
  try {
    return await Content.findById(contentId).select('captions transcript');
  } catch (e) {
    logger.warn('captionStore: content load failed', { contentId: String(contentId), error: e.message });
    return null;
  }
}

function fromCaptionDoc(doc) {
  if (!doc) return null;
  return {
    language: lc(doc.language),
    text: doc.text || '',
    format: doc.format || 'srt',
    segments: Array.isArray(doc.segments) ? doc.segments : [],
    words: Array.isArray(doc.words) ? doc.words : [],
    formatted: doc.formatted || '',
    isSource: doc.isSource !== false,
  };
}

function embeddedSource(emb) {
  if (!emb || !emb.text) return null;
  return {
    language: lc(emb.language || 'en'),
    text: emb.text,
    format: emb.format || 'srt',
    segments: Array.isArray(emb.segments) ? emb.segments : [],
    words: Array.isArray(emb.words) ? emb.words : [],
    formatted: emb.formatted || '',
    isSource: true,
  };
}

// ── Reads (collection first, embedded fallback) ─────────────────────────────

/** The original-language captions (the ones that carry word-level timing). */
async function getSource(contentId, opts = {}) {
  if (isQueryableId(contentId)) {
    const doc = await safeFindOne({ contentId, isSource: true });
    if (doc) return fromCaptionDoc(doc);
  }
  const c = await loadContent(contentId, opts.content);
  return embeddedSource(c?.captions);
}

/** Captions in a specific language (source or a translation), or null. */
async function getInLanguage(contentId, language, opts = {}) {
  const lang = lc(language);
  if (lang && isQueryableId(contentId)) {
    const doc = await safeFindOne({ contentId, language: lang });
    if (doc) return fromCaptionDoc(doc);
  }
  // Embedded fallback for un-migrated content.
  const c = await loadContent(contentId, opts.content);
  const emb = c?.captions;
  if (!emb) return null;
  const srcLang = lc(emb.language || 'en');
  if (!lang || lang === srcLang || lang.split('-')[0] === srcLang.split('-')[0]) {
    return embeddedSource(emb);
  }
  const t = emb.translations?.[lang];
  if (t?.text) {
    return {
      language: lang,
      text: t.text,
      format: t.format || emb.format || 'srt',
      segments: Array.isArray(t.segments) ? t.segments : [],
      words: [],
      formatted: t.formatted || '',
      isSource: false,
    };
  }
  return null;
}

async function getWords(contentId, opts = {}) {
  const src = await getSource(contentId, opts);
  return src?.words || [];
}

async function getSegments(contentId, opts = {}) {
  const src = await getSource(contentId, opts);
  return src?.segments || [];
}

async function getText(contentId, opts = {}) {
  const src = await getSource(contentId, opts);
  return src?.text || '';
}

async function hasCaptions(contentId, opts = {}) {
  if (isQueryableId(contentId) && await safeExists({ contentId, isSource: true })) return true;
  const c = await loadContent(contentId, opts.content);
  return !!c?.captions?.text;
}

async function hasTranslation(contentId, language, opts = {}) {
  const lang = lc(language);
  if (lang && isQueryableId(contentId) && await safeExists({ contentId, language: lang, isSource: false })) return true;
  const c = await loadContent(contentId, opts.content);
  return !!c?.captions?.translations?.[lang]?.text;
}

// ── Writes (heavy → collection, slim marker → Content) ──────────────────────

/**
 * Upsert the original-language captions (carries word timing).
 * `opts.embedSlim` (default true) also writes the slim marker to Content via
 * findByIdAndUpdate. Pass false from callers that mutate an in-memory Content doc
 * and call `.save()` themselves (they set their own slim marker) to avoid a
 * redundant/competing write.
 */
async function saveSource(contentId, data = {}, opts = {}) {
  const { embedSlim = true } = opts;
  const language = lc(data.language || 'en');
  const generatedAt = data.generatedAt || new Date();
  // Only ObjectId-backed content lives in the Caption collection (dev-store /
  // non-ObjectId ids can't — they're handled by the embedded marker below).
  if (isQueryableId(contentId)) await Caption.findOneAndUpdate(
    { contentId, language },
    {
      $set: {
        contentId,
        language,
        isSource: true,
        text: data.text || '',
        format: data.format || 'srt',
        segments: Array.isArray(data.segments) ? data.segments : [],
        words: Array.isArray(data.words) ? data.words : [],
        formatted: data.formatted || '',
        generatedAt,
      },
    },
    { upsert: true, new: true },
  );
  // Keep a slim embedded marker so `content.captions?.text` checks + light
  // metadata keep working WITHOUT the multi-MB arrays. (No $unset of legacy
  // heavy fields here — the migration script handles cleanup, so re-captioning
  // old content never loses data the collection hasn't captured yet.)
  if (!embedSlim) return { contentId, language, generatedAt };
  await Content.findByIdAndUpdate(contentId, {
    $set: {
      transcript: data.text || '',
      'captions.text': data.text || '',
      'captions.language': language,
      'captions.format': data.format || 'srt',
      'captions.generatedAt': generatedAt,
    },
  });
  return { contentId, language, generatedAt };
}

/** Upsert a translation (segment-level; no word timing). */
async function saveTranslation(contentId, language, data = {}) {
  const lang = lc(language);
  if (!lang) throw new Error('saveTranslation: language required');
  if (isQueryableId(contentId)) await Caption.findOneAndUpdate(
    { contentId, language: lang },
    {
      $set: {
        contentId,
        language: lang,
        isSource: false,
        text: data.text || '',
        format: data.format || 'srt',
        segments: Array.isArray(data.segments) ? data.segments : [],
        words: [],
        formatted: data.formatted || '',
        translatedAt: data.translatedAt || new Date(),
      },
    },
    { upsert: true, new: true },
  );
  return { contentId, language: lang };
}

module.exports = {
  getSource,
  getInLanguage,
  getWords,
  getSegments,
  getText,
  hasCaptions,
  hasTranslation,
  saveSource,
  saveTranslation,
  // exported for the migration script + tests
  _internal: { fromCaptionDoc, embeddedSource, lc },
};

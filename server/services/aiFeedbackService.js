/**
 * aiFeedbackService — ONE feedback path for EVERY AI surface (captions, hooks,
 * clips, ideas, scripts, music, smart-publish defaults), generalising the proven
 * AI-Director loop (routes/ai/director.js). A feedback event:
 *   1. logs a SuggestionFeedback row (with the mistake `reason` when negative),
 *   2. nudges the creator's UserStyleProfile (positive upweights + records the
 *      pick; negative/regenerate/heavy-edit downweights) via the existing
 *      personalizationService.recordChoices primitive,
 *   3. busts the persona cache so the very next generation reflects it.
 *
 * "Learns from MISTAKES": a `regenerate`, a heavy `edit`, or an explicit
 * `reject`/`bad` with a reason is recorded as a NEGATIVE performance nudge tagged
 * with the reason, so buildPersonalizedSystemPrompt can add an "avoid …" line.
 *
 * Defensive like personalizationService: best-effort, NEVER throws to the caller
 * (feedback must never break a flow), per-user scoped.
 */

'use strict';

const SuggestionFeedback = require('../models/SuggestionFeedback');
const personalizationService = require('./personalizationService');
const logger = require('../utils/logger');

// itemType → { fbFacet (SuggestionFeedback enum), pick (UserStyleProfile facet),
// weighted (perf-weighted facet) }. Items with no style facet (clip/idea/script)
// are still LOGGED (useful for the mistake/avoid signal + analytics) but don't
// nudge a style counter — we never invent a facet.
const ITEM_MAP = {
  caption:      { fbFacet: 'caption',    pick: 'captionStyles', weighted: 'weightedCaptionStyles' },
  captionstyle: { fbFacet: 'caption',    pick: 'captionStyles', weighted: 'weightedCaptionStyles' },
  hook:         { fbFacet: 'other',      pick: 'hookStyles',    weighted: 'weightedHooks' },
  color:        { fbFacet: 'other',      pick: 'colorGrades',   weighted: 'weightedColorGrades' },
  colorgrade:   { fbFacet: 'other',      pick: 'colorGrades',   weighted: 'weightedColorGrades' },
  transition:   { fbFacet: 'transition', pick: 'transitions',   weighted: 'weightedTransitions' },
  pacing:       { fbFacet: 'pacing',     pick: null,            weighted: 'weightedPacing' },
  music:        { fbFacet: 'music',      pick: 'musicGenres',   weighted: null },
  musicgenre:   { fbFacet: 'music',      pick: 'musicGenres',   weighted: null },
  hashtag:      { fbFacet: 'other',      pick: null,            weighted: 'weightedHashtags' },
  cta:          { fbFacet: 'other',      pick: null,            weighted: 'weightedCtaCategories' },
  voicetone:    { fbFacet: 'other',      pick: null,            weighted: 'weightedVoiceTones' },
  font:         { fbFacet: 'other',      pick: 'fonts',         weighted: 'weightedFonts' },
  preset:       { fbFacet: 'other',      pick: 'presets',       weighted: null },
  clip:         { fbFacet: 'other',      pick: null,            weighted: null },
  idea:         { fbFacet: 'other',      pick: null,            weighted: null },
  script:       { fbFacet: 'other',      pick: null,            weighted: null },
};

const POSITIVE_ACTIONS = new Set(['accept', 'thumbs_up', 'apply', 'choose', 'keep', 'use']);
const NEGATIVE_ACTIONS = new Set(['reject', 'thumbs_down', 'regenerate', 'bad', 'undo']);
const DISMISS_ACTIONS = new Set(['dismiss', 'skip', 'ignore']);
const POSITIVE_NUDGE = 0.3;
const NEGATIVE_NUDGE = -0.2;
// A small edit isn't a mistake; only a substantial rewrite (≥30% changed) counts.
const EDIT_MISTAKE_THRESHOLD = 0.3;

// Tokens that are param NAMES / generic noise — never a categorical learning key
// (mirrors the Director's H3 guard so client garbage can't become a learned style).
const PARAM_NAME_TOKENS = new Set([
  'text', 'keyword', 'duration', 'time', 'grade', 'style', 'strategy', 'speed',
  'start', 'end', 'name', 'action', 'reason', 'undefined', 'null',
]);

function categorical(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s || PARAM_NAME_TOKENS.has(s.toLowerCase())) return null;
  return s.slice(0, 80);
}

function classify(action) {
  const a = String(action || '').toLowerCase();
  if (POSITIVE_ACTIONS.has(a)) return 'positive';
  if (NEGATIVE_ACTIONS.has(a)) return 'negative';
  if (DISMISS_ACTIONS.has(a)) return 'dismiss';
  if (a === 'edit') return 'edit';
  return null;
}

/**
 * Record one feedback event from any AI surface.
 * @param {object} ev
 * @param {string} ev.userId
 * @param {string} [ev.surface]    e.g. 'caption-panel', 'hook-suggest', 'auto-clip'
 * @param {string} [ev.itemType]   ITEM_MAP key (caption|hook|color|transition|pacing|music|hashtag|cta|clip|idea|script…)
 * @param {string} ev.action       accept|reject|thumbs_up|thumbs_down|regenerate|edit|dismiss
 * @param {string} [ev.value]      the CATEGORICAL value (e.g. 'curiosity-gap', 'hormozi-bold')
 * @param {string} [ev.reason]     the mistake reason when negative ('wrong tone', 'weak hook', 'too long')
 * @param {string} [ev.contentId]
 * @param {number} [ev.magnitude]  0..1 edit-distance fraction (for action='edit')
 * @returns {Promise<{ok:boolean, signal?:string, error?:string}>}
 */
async function recordFeedback(ev = {}) {
  const { userId, surface, itemType, action, value, reason, contentId, magnitude } = ev;
  if (!userId) return { ok: false, error: 'userId required' };
  const kind = classify(action);
  if (!kind) return { ok: false, error: 'invalid action' };

  const map = ITEM_MAP[String(itemType || '').trim().toLowerCase()] || { fbFacet: 'other', pick: null, weighted: null };
  const key = categorical(value);
  const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 120) : null;

  // 'edit' is a mistake (negative) only when the rewrite was substantial.
  let signal = kind;
  if (kind === 'edit') signal = (Number(magnitude) >= EDIT_MISTAKE_THRESHOLD) ? 'negative' : null;

  // 1. Log the feedback row (best-effort) — keep the reason on negatives.
  if (signal) {
    try {
      await SuggestionFeedback.create({
        userId,
        suggestionId: surface || null,
        facet: map.fbFacet,
        key: key || (surface || itemType || 'unknown'),
        signal: signal === 'edit' ? 'negative' : signal,
        reason: signal === 'negative' ? cleanReason : null,
        contentId: contentId || null,
        metadata: { surface: surface || null, itemType: itemType || null, action, magnitude: magnitude ?? null },
      });
    } catch (err) {
      logger.warn('[aiFeedback] log failed', { error: err.message });
    }
  }

  // 2. Nudge the profile when we have a mapped facet + a real categorical value.
  if (key && (map.pick || map.weighted)) {
    const choices = [];
    if (signal === 'positive') {
      if (map.pick) choices.push({ facet: map.pick, key });
      if (map.weighted) choices.push({ weightedFacet: map.weighted, key, retentionDelta: POSITIVE_NUDGE });
    } else if (signal === 'negative') {
      const scale = kind === 'edit' ? Math.min(1, Math.max(0.3, Number(magnitude) || 0.5)) : 1;
      if (map.weighted) choices.push({ weightedFacet: map.weighted, key, retentionDelta: NEGATIVE_NUDGE * scale });
    }
    if (choices.length) {
      try {
        await personalizationService.recordChoices(userId, choices);
      } catch (err) {
        logger.warn('[aiFeedback] nudge failed', { error: err.message });
      }
    }
  }

  // 3. Bust the persona cache so the next generation reflects this immediately.
  try { personalizationService.invalidatePersona(userId); } catch (_) { /* best effort */ }

  return { ok: true, signal: signal || kind };
}

module.exports = { recordFeedback, ITEM_MAP };

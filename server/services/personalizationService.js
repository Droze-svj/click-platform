/**
 * personalizationService — one façade that makes every AI surface learn each
 * creator. It READS the platform's existing learning stores (UserStyleProfile
 * weighted facets, getTopPerformingPlaybook, UserPreferences voice/brand),
 * BUILDS a personalized system prompt by reusing marketingKnowledge.buildSystemPrompt,
 * and WRITES new choices back via UserStyleProfile.recordPick/recordPerformance so
 * the profile keeps improving as it's used.
 *
 * Design: defensive like creatorDnaService — lazy reads, Promise.allSettled,
 * NEVER throws to a caller (personalization must never block a generation), and a
 * 60s in-process TTL cache so we don't hit the DB ≤3× on every AI request.
 */

'use strict';

const mongoose = require('mongoose');
const UserStyleProfile = require('../models/UserStyleProfile');
const UserPreferences = require('../models/UserPreferences');
const marketingKnowledge = require('./marketingKnowledge');
const logger = require('../utils/logger');

const PERSONA_TTL_MS = 60 * 1000;
const PERSONA_CACHE_MAX = 5000; // hard cap so the cache can't grow unbounded
const _personaCache = new Map(); // key `${userId}|${niche}|${platform}` → { value, expires }

/** Insert into the TTL cache with size-bounded (oldest-first) eviction. */
function cacheSet(key, value) {
  // Map preserves insertion order, so deleting the first key drops the oldest.
  if (_personaCache.size >= PERSONA_CACHE_MAX) {
    const oldest = _personaCache.keys().next().value;
    if (oldest !== undefined) _personaCache.delete(oldest);
  }
  _personaCache.set(key, { value, expires: Date.now() + PERSONA_TTL_MS });
}

// The facets UserStyleProfile.recordPick / recordPerformance accept. They THROW
// on an unknown facet, so recordChoices pre-filters against these.
const PICK_FACETS = new Set([
  'fonts', 'captionStyles', 'animations', 'motions', 'colorGrades', 'transitions',
  'niches', 'platforms', 'presets', 'hookStyles', 'musicGenres', 'publishHours',
  'publishDays', 'captionVariantsAccepted',
]);
const PERF_FACETS = new Set([
  'weightedFonts', 'weightedCaptionStyles', 'weightedAnimations', 'weightedMotions',
  'weightedColorGrades', 'weightedTransitions', 'weightedHooks', 'weightedPacing',
  'weightedVoiceTones', 'weightedCtaCategories', 'weightedHashtags',
]);

function isObjectId(id) {
  return id != null && mongoose.Types.ObjectId.isValid(String(id));
}

function emptyPersona(niche, platform) {
  return {
    styleProfile: null,
    topPerformers: null,
    voice: { tone: '', hookStyle: '', pacing: '', vocab: [], banned: [] },
    brand: { colors: { primary: '', accent: '' }, fonts: { title: '', body: '' }, colorGrade: '', transition: '' },
    preferences: null,
    niche: niche || null,
    platform: platform || null,
  };
}

/**
 * Normalized persona for a creator. Cold-start safe (all-null), never throws.
 * getPersona(null) does NO I/O.
 * @returns {Promise<object>}
 */
async function getPersona(userId, { niche, platform } = {}) {
  if (!userId) return emptyPersona(niche, platform);

  const cacheKey = `${userId}|${niche || ''}|${platform || ''}`;
  const cached = _personaCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  const [profileR, topR, prefsR] = await Promise.allSettled([
    isObjectId(userId) ? UserStyleProfile.findOne({ userId }).lean() : Promise.resolve(null),
    marketingKnowledge.getTopPerformingPlaybook(userId, niche, platform, { minSamples: 3 }),
    UserPreferences.findOne({ userId }).lean(),
  ]);

  const styleProfile = profileR.status === 'fulfilled' ? profileR.value : null;
  const topPerformers = topR.status === 'fulfilled' ? topR.value : null;
  const prefs = prefsR.status === 'fulfilled' ? prefsR.value : null;
  if (profileR.status === 'rejected') logger.warn('[personalization] style profile read failed', { error: profileR.reason?.message });

  const ve = prefs?.videoEditing || {};
  const bk = prefs?.brandKit || {};
  const persona = {
    styleProfile: styleProfile || null,
    topPerformers: topPerformers || null,
    voice: {
      tone: ve.preferredVoiceTone || '',
      hookStyle: ve.preferredHookStyle || '',
      pacing: ve.pacingIntensity || '',
      vocab: Array.isArray(ve.brandVocab) ? ve.brandVocab.filter((x) => typeof x === 'string') : [],
      banned: Array.isArray(ve.bannedWords) ? ve.bannedWords.filter((x) => typeof x === 'string') : [],
    },
    brand: {
      colors: { primary: bk.primaryColor || '', accent: bk.accentColor || '' },
      fonts: { title: bk.titleFont || '', body: bk.bodyFont || '' },
      colorGrade: ve.aestheticColorGrade || '',
      transition: ve.aestheticTransition || '',
    },
    preferences: prefs || null,
    niche: niche || prefs?.marketingIntelligence?.niche || null,
    platform: platform || null,
  };

  cacheSet(cacheKey, persona);
  return persona;
}

/** Drop cached personas for a user (call after a preferences write). */
function invalidatePersona(userId) {
  if (!userId) return;
  const prefix = `${userId}|`;
  for (const key of _personaCache.keys()) {
    if (key.startsWith(prefix)) _personaCache.delete(key);
  }
}

/**
 * Build a personalized system prompt by reusing marketingKnowledge.buildSystemPrompt:
 * learned style + "what worked for this creator" (auto), the creator's saved
 * tone/vocab/banned (via the new `voice` param → personality block), and brand
 * colours/fonts (via `extra`). Cold-start (no userId / no data) == the plain base
 * prompt. Never throws — returns the base prompt (or '') on any failure.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.niche]
 * @param {string} [opts.platform]
 * @param {string} [opts.role='creative-director'] marketingKnowledge persona
 * @param {string} [opts.stage='script']
 * @param {string} [opts.extra]
 * @param {object} [opts.override] per-request override { tone?, creativity? } (tone used here)
 * @param {object} [opts.persona] pre-fetched persona (skips the getPersona read)
 * @returns {Promise<string>}
 */
async function buildPersonalizedSystemPrompt({ userId, niche, platform, role = 'creative-director', stage = 'script', language = 'en', extra = '', override = null, persona = null } = {}) {
  try {
    const p = persona || await getPersona(userId, { niche, platform });

    const tone = (override && typeof override.tone === 'string' && override.tone.trim()) || p.voice.tone || '';
    // The voice object carries the archetype seed (userId) AND custom overrides;
    // only built when we have a user (cold-start keeps the niche/static seed).
    const voice = userId ? { userId, tone, vocab: p.voice.vocab, customBanned: p.voice.banned } : null;

    const brandLines = [];
    if (p.brand.colors.primary) {
      brandLines.push(`Brand palette: primary ${p.brand.colors.primary}${p.brand.colors.accent ? `, accent ${p.brand.colors.accent}` : ''}. Reference these where the copy touches visuals or thumbnails.`);
    }
    if (p.voice.hookStyle) brandLines.push(`The creator's go-to hook framework is "${p.voice.hookStyle}" — favour it unless another clearly fits the clip better.`);
    if (p.voice.pacing) brandLines.push(`Preferred pacing intensity: ${p.voice.pacing}.`);
    const extraBlock = [extra, brandLines.join('\n')].filter(Boolean).join('\n');

    return marketingKnowledge.buildSystemPrompt({
      persona: role,
      niche,
      platform,
      stage,
      language,
      styleProfile: p.styleProfile || (userId ? { userId } : null),
      topPerformers: p.topPerformers,
      voice,
      extra: extraBlock,
    });
  } catch (e) {
    logger.warn('[personalization] buildPersonalizedSystemPrompt failed; using base prompt', { error: e.message });
    try {
      return marketingKnowledge.buildSystemPrompt({ persona: role, niche, platform, stage, language });
    } catch (_) {
      return '';
    }
  }
}

/**
 * Record one or more creator choices back into the learned profile so it keeps
 * improving. Each choice is `{ facet, key }` (a pick) or `{ weightedFacet, key,
 * retentionDelta }` (a performance nudge). Unknown facets are dropped (the model
 * throws on them). Never throws.
 * @returns {Promise<{recorded:number}>}
 */
async function recordChoices(userId, choices) {
  if (!userId || !isObjectId(userId) || !Array.isArray(choices) || !choices.length) return { recorded: 0 };
  const ops = [];
  for (const c of choices) {
    if (!c || typeof c !== 'object' || c.key == null || String(c.key).trim() === '') continue;
    const key = String(c.key).slice(0, 80);
    if (c.weightedFacet && PERF_FACETS.has(c.weightedFacet)) {
      const d = typeof c.retentionDelta === 'number' ? Math.max(-1, Math.min(1, c.retentionDelta)) : 0.3;
      ops.push(UserStyleProfile.recordPerformance(userId, c.weightedFacet, key, d));
    } else if (c.facet && PICK_FACETS.has(c.facet)) {
      ops.push(UserStyleProfile.recordPick(userId, c.facet, key));
    }
  }
  if (!ops.length) return { recorded: 0 };
  const results = await Promise.allSettled(ops);
  results.forEach((r) => { if (r.status === 'rejected') logger.warn('[personalization] recordChoice failed', { error: r.reason?.message }); });
  return { recorded: ops.length };
}

module.exports = {
  getPersona,
  buildPersonalizedSystemPrompt,
  recordChoices,
  invalidatePersona,
  PICK_FACETS,
  PERF_FACETS,
};

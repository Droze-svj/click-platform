/**
 * /api/me — per-creator personalization controls + the learning write-loop.
 *
 *   POST /api/me/personalization/record   record choices → trains UserStyleProfile
 *   GET  /api/me/ai-preferences           read the creator's AI voice/brand/defaults
 *   PUT  /api/me/ai-preferences           update them (whitelisted)
 *
 * The record endpoint is how acting on an AI result (downloading a variant,
 * applying a recipe, using a generated asset) keeps improving the profile, so the
 * AI gets more personalized the more it's used. It's best-effort and always 200 —
 * the learning loop must never break a UI flow.
 */

const express = require('express');
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const UserPreferences = require('../models/UserPreferences');
const UserStyleProfile = require('../models/UserStyleProfile');
const personalizationService = require('../services/personalizationService');

const router = express.Router();

// Prefer the real ObjectId so UserStyleProfile writes cast cleanly (the dev
// user's `id` is a non-hex string); UserPreferences.userId is Mixed either way.
function uid(req) {
  return req.user?._id || req.user?.id;
}

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : undefined;
}
function strArray(v, maxItems, maxLen) {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, maxLen)).slice(0, maxItems);
}

// Pure shaper for GET /personalization/recommendations — takes the persisted
// `marketingIntelligence` sub-doc and returns the trimmed, cold-start-safe
// response. Extracted so the populated path is unit-testable without a DB.
function shapeRecommendations(mi) {
  const m = mi || {};
  const bp = m.activeCreativeBlueprint || null;
  const perf = m.historicalPerformanceMetrics || null;
  const hasData = !!(bp && typeof bp === 'object' && Object.keys(bp).length > 0);
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
  return {
    hasData,
    lastSync: m.lastLearningSync || null,
    performance: perf ? {
      avgRetentionDelta: Number(perf.avgRetentionDelta) || 0,
      sampleSize: Number(perf.sampleSize) || 0,
      hasRealData: !!perf.hasRealData,
    } : null,
    blueprint: hasData ? {
      recommendedColorMood: bp.recommendedColorMood || '',
      pacingStrategy: bp.pacingStrategy || '',
      captionStyle: bp.captionStyle || '',
      recommendedVfx: arr(bp.recommendedVfx),
      failingPatterns: arr(bp.failingPatterns),
      suggestedPivot: bp.suggestedPivot || '',
      contentSeriesWinners: arr(bp.contentSeriesWinners),
      rationale: bp.rationale || '',
    } : null,
  };
}

// ── POST /personalization/record ─────────────────────────────────────────────
router.post(
  '/personalization/record',
  auth,
  asyncHandler(async (req, res) => {
    const choices = Array.isArray(req.body?.choices) ? req.body.choices.slice(0, 20) : [];
    let result = { recorded: 0 };
    try {
      result = await personalizationService.recordChoices(uid(req), choices);
    } catch (e) {
      logger.warn('[me] record choices failed', { error: e.message });
    }
    return sendSuccess(res, result); // best-effort, always 200
  })
);

// ── GET /personalization/insights ────────────────────────────────────────────
// "What Click has learned about you" — a cheap, read-only snapshot of the
// learned style graph (one findOne, no AI). Builds trust + makes the loop visible.
router.get(
  '/personalization/insights',
  auth,
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    let profile = null;
    try {
      if (mongoose.Types.ObjectId.isValid(String(userId))) profile = await UserStyleProfile.findOne({ userId });
    } catch (e) {
      logger.warn('[me] insights read failed', { error: e.message });
    }
    if (!profile) return sendSuccess(res, { confidence: 'low', sample: 0, learned: {} });

    const keys = (arr) => (Array.isArray(arr) ? arr.map((p) => p && p.key).filter(Boolean) : []);
    const top = (facet) => (typeof profile.topPicks === 'function' ? keys(profile.topPicks(facet, 3)) : []);
    const perf = (facet) => (typeof profile.topPerformers === 'function' ? keys(profile.topPerformers(facet, 3)) : []);
    const sample = profile.totalPicks || 0;
    const confidence = sample >= 50 ? 'high' : sample >= 10 ? 'medium' : 'low';

    return sendSuccess(res, {
      confidence,
      sample,
      learned: {
        topPlatforms: top('platforms'),
        topHookStyles: top('hookStyles'),
        topCaptionStyles: top('captionStyles'),
        topColorGrades: top('colorGrades'),
        topNiches: top('niches'),
        provenHooks: perf('weightedHooks'),
        provenColorGrades: perf('weightedColorGrades'),
        avgCutDurationSec: profile.averages?.avgCutDuration ?? null,
      },
    });
  })
);

// ── GET /personalization/recommendations ─────────────────────────────────────
// "What Click recommends for you" — the creative blueprint the continuous-
// learning loop derived from the creator's REAL post analytics (color mood,
// pacing, what's failing, a suggested pivot, winning series). Cheap read of the
// persisted blueprint (no AI). Cold-start safe: hasData:false until the loop runs.
router.get(
  '/personalization/recommendations',
  auth,
  asyncHandler(async (req, res) => {
    let mi = {};
    try {
      const prefs = await UserPreferences.findOne({ userId: uid(req) }).lean();
      mi = prefs?.marketingIntelligence || {};
    } catch (e) {
      logger.warn('[me] recommendations read failed', { error: e.message });
    }
    return sendSuccess(res, shapeRecommendations(mi));
  })
);

// ── GET /ai-preferences ──────────────────────────────────────────────────────
router.get(
  '/ai-preferences',
  auth,
  asyncHandler(async (req, res) => {
    const prefs = await UserPreferences.findOne({ userId: uid(req) }).lean();
    const ve = prefs?.videoEditing || {};
    const bk = prefs?.brandKit || {};
    const mi = prefs?.marketingIntelligence || {};
    return sendSuccess(res, {
      voice: {
        tone: ve.preferredVoiceTone || '',
        hookStyle: ve.preferredHookStyle || '',
        pacing: ve.pacingIntensity || 'medium',
        vocab: Array.isArray(ve.brandVocab) ? ve.brandVocab : [],
        banned: Array.isArray(ve.bannedWords) ? ve.bannedWords : [],
      },
      brand: {
        primaryColor: bk.primaryColor || '',
        accentColor: bk.accentColor || '',
        titleFont: bk.titleFont || '',
        bodyFont: bk.bodyFont || '',
        colorGrade: ve.aestheticColorGrade || '',
      },
      defaults: {
        niche: mi.niche || '',
        platformFocus: Array.isArray(mi.platformFocus) ? mi.platformFocus : [],
      },
    });
  })
);

// ── PUT /ai-preferences ──────────────────────────────────────────────────────
router.put(
  '/ai-preferences',
  auth,
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const body = req.body || {};

    let prefs = await UserPreferences.findOne({ userId });
    if (!prefs) prefs = new UserPreferences({ userId });
    prefs.videoEditing = prefs.videoEditing || {};
    prefs.brandKit = prefs.brandKit || {};
    prefs.marketingIntelligence = prefs.marketingIntelligence || {};

    const v = body.voice || {};
    if (str(v.tone, 120) !== undefined) prefs.videoEditing.preferredVoiceTone = str(v.tone, 120);
    if (str(v.hookStyle, 60) !== undefined) prefs.videoEditing.preferredHookStyle = str(v.hookStyle, 60);
    if (['gentle', 'medium', 'aggressive'].includes(v.pacing)) prefs.videoEditing.pacingIntensity = v.pacing;
    if (strArray(v.vocab, 30, 40) !== undefined) prefs.videoEditing.brandVocab = strArray(v.vocab, 30, 40);
    if (strArray(v.banned, 30, 40) !== undefined) prefs.videoEditing.bannedWords = strArray(v.banned, 30, 40);

    const b = body.brand || {};
    if (str(b.primaryColor, 16) !== undefined) prefs.brandKit.primaryColor = str(b.primaryColor, 16);
    if (str(b.accentColor, 16) !== undefined) prefs.brandKit.accentColor = str(b.accentColor, 16);
    if (str(b.titleFont, 60) !== undefined) prefs.brandKit.titleFont = str(b.titleFont, 60);
    if (str(b.bodyFont, 60) !== undefined) prefs.brandKit.bodyFont = str(b.bodyFont, 60);
    if (str(b.colorGrade, 40) !== undefined) prefs.videoEditing.aestheticColorGrade = str(b.colorGrade, 40);

    const d = body.defaults || {};
    if (str(d.niche, 40) !== undefined) prefs.marketingIntelligence.niche = str(d.niche, 40);
    if (strArray(d.platformFocus, 10, 30) !== undefined) prefs.marketingIntelligence.platformFocus = strArray(d.platformFocus, 10, 30);

    prefs.markModified('videoEditing');
    prefs.markModified('brandKit');
    prefs.markModified('marketingIntelligence');
    try {
      await prefs.save();
    } catch (e) {
      return sendError(res, 'Could not save preferences', 500);
    }
    personalizationService.invalidatePersona(userId); // so the next generation sees the change immediately

    return sendSuccess(res, { saved: true });
  })
);

module.exports = router;
module.exports.shapeRecommendations = shapeRecommendations;

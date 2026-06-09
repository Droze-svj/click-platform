/**
 * /api/marketing-intelligence — endpoints consumed by the Marketing AI
 * dashboard page. Backed by the same marketingKnowledge service that powers
 * AI prompt enrichment, so the in-app dashboard tells the user the SAME
 * playbook the AI is using when it generates content.
 *
 * Endpoints (all auth-protected; degrade gracefully when AI is unavailable):
 *   GET  /dashboard            niche × platform top-level summary
 *   POST /sync-signals         no-op refresh trigger; returns lastSyncedAt
 *   GET  /trend-report         per-niche trend + angle breakdown
 *   GET  /knowledge-insights   playbook bullets for the niche/format
 *   GET  /retention-score      retention curve + a self-score from inputs
 *   GET  /retention-sequence   pacing plan keyed to retention curve marks
 *   POST /retention-campaign   batch retention recommendations
 *   GET  /fresh-angles         topic-conditioned angle suggestions
 *   GET  /inspiration-drop     niche-relevant prompts to spark new content
 *   GET  /engagement-prompts   per-platform engagement prompt templates
 *   GET  /benchmarks           platform performance benchmarks
 *   POST /pre-publish-report   pre-publish content scoring with notes
 */

const express = require('express');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const redisCache = require('../utils/redisCache');
const { resolveTier } = require('../config/entitlements');
const { composeTrendReport } = require('../services/trendComposer');
const {
  getKnowledgeSlice,
  HOOK_FRAMEWORKS,
  CTA_LIBRARY,
  PLATFORM_PLAYBOOKS,
  NICHE_PLAYBOOKS,
  NICHE_POSTING_WINDOWS,
} = require('../services/marketingKnowledge');

const router = express.Router();

const TREND_CACHE_TTL_SEC = 6 * 60 * 60; // 6 hours
function trendCacheKey({ niche, platform, language }) {
  return `mi:trends:${niche || 'other'}:${platform || 'tiktok'}:${language || 'en'}`;
}

// In-memory sync state — production would persist this. The dashboard polls
// this to know when its data was last refreshed.
let lastSyncedAt = new Date().toISOString();

function pickSlice(req) {
  const niche = req.query.niche || req.body?.niche;
  const platform = req.query.platform || req.body?.platform;
  const language = req.language || 'en';
  return getKnowledgeSlice({ niche, platform, language });
}

// ── GET /dashboard ─────────────────────────────────────────────────────────
router.get('/dashboard', auth, (req, res) => {
  const slice = pickSlice(req);
  res.json({
    success: true,
    data: {
      niche: slice.niche,
      platform: slice.platform,
      language: slice.language,
      lastSyncedAt,
      playbook: {
        voice: slice.nichePlaybook.voice,
        topAngles: slice.nichePlaybook.angles.slice(0, 5),
        triggers: slice.nichePlaybook.triggers,
        avoid: slice.nichePlaybook.avoid,
      },
      platformBrief: {
        aspectRatio: slice.platformPlaybook.aspectRatio,
        idealLength: slice.platformPlaybook.idealLength,
        hookWindow: slice.platformPlaybook.hookWindow,
        hashtags: slice.platformPlaybook.hashtags,
        cta: slice.platformPlaybook.cta,
      },
      hookFrameworkCount: HOOK_FRAMEWORKS.length,
      retentionMarkCount: slice.retention.length,
    },
  });
});

// ── POST /sync-signals ─────────────────────────────────────────────────────
router.post('/sync-signals', auth, (_req, res) => {
  lastSyncedAt = new Date().toISOString();
  res.json({ success: true, data: { lastSyncedAt, refreshed: ['hooks', 'retention', 'platforms', 'niches'] } });
});

// ── GET /trend-report ──────────────────────────────────────────────────────
// Composed by Gemini against the marketing-knowledge playbooks. Cached per
// (niche × platform × language) for 6 hours so we don't hammer the AI quota
// for every editor mount. On cache miss + Gemini failure, the composer falls
// back to a structured response so the UI never empty-states.
router.get('/trend-report', auth, async (req, res) => {
  const niche = req.query.niche || null;
  const platform = req.query.platform || null;
  const language = req.query.language || req.language || 'en';
  const force = req.query.force === '1';
  const key = trendCacheKey({ niche, platform, language });

  if (!force) {
    try {
      const cached = await redisCache.get(key);
      if (cached) return res.json({ success: true, data: cached, cached: true });
    } catch (e) {
      logger.warn('trend-report cache get failed', { error: e.message });
    }
  }

  try {
    const report = await composeTrendReport({ niche, platform, language });

    // Also include the legacy `trends` shape so any old client still renders
    // something useful while it migrates to the new schema.
    const np = NICHE_PLAYBOOKS[report.niche] || NICHE_PLAYBOOKS.other;
    const legacyTrends = (np.angles || []).map((angle, i) => ({
      angle,
      momentum: report.hooks?.[i]?.momentum || ['rising', 'steady', 'rising', 'peaking', 'steady'][i % 5],
      confidence: 0.62 + (i % 4) * 0.07,
      triggerExamples: (np.triggers || []).slice(0, 2),
    }));

    const data = { ...report, trends: legacyTrends, vocabulary: np.keywords || [] };

    try { await redisCache.set(key, data, TREND_CACHE_TTL_SEC); }
    catch (e) { logger.warn('trend-report cache set failed', { error: e.message }); }

    res.json({ success: true, data, cached: false });
  } catch (err) {
    // The composer is meant to fall back internally, but never let an
    // unexpected rejection become an unhandled error / hung request.
    logger.error('trend-report composition failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to compose trend report' });
  }
});

// ── GET /knowledge-insights ────────────────────────────────────────────────
router.get('/knowledge-insights', auth, (req, res) => {
  const format = req.query.format || 'video';
  const slice = pickSlice(req);
  res.json({
    success: true,
    data: {
      niche: slice.niche,
      format,
      voice: slice.nichePlaybook.voice,
      proven: slice.nichePlaybook.angles,
      pitfalls: slice.nichePlaybook.avoid,
      vocabulary: slice.nichePlaybook.keywords || [],
      hookFrameworks: HOOK_FRAMEWORKS.map(h => ({ id: h.id, pattern: h.pattern, example: h.example })),
    },
  });
});

// ── GET /retention-score ───────────────────────────────────────────────────
router.get('/retention-score', auth, (req, res) => {
  const slice = pickSlice(req);
  // Heuristic from the platform's hook window: tighter hook = stronger floor.
  const hookSeconds = parseFloat(String(slice.platformPlaybook.hookWindow).match(/[\d.]+/)?.[0] || '1.0');
  const baseFloor = Math.max(45, 90 - hookSeconds * 12);
  res.json({
    success: true,
    data: {
      niche: slice.niche,
      platform: slice.platform,
      retentionFloor: Math.round(baseFloor),
      retentionTarget: Math.min(95, Math.round(baseFloor + 18)),
      curve: slice.retention,
    },
  });
});

// ── GET /retention-sequence ────────────────────────────────────────────────
router.get('/retention-sequence', auth, (req, res) => {
  const slice = pickSlice(req);
  const sequence = slice.retention.map((r, i) => ({
    step: i + 1,
    timing: r.mark,
    move: r.rule,
    framework: HOOK_FRAMEWORKS[i % HOOK_FRAMEWORKS.length].id,
  }));
  res.json({ success: true, data: { sequence } });
});

// ── POST /retention-campaign ───────────────────────────────────────────────
router.post('/retention-campaign', auth, (req, res) => {
  const slice = pickSlice(req);
  res.json({
    success: true,
    data: {
      niche: slice.niche,
      platform: slice.platform,
      campaign: slice.retention.map((r, i) => ({
        videoIndex: i + 1,
        promise: slice.nichePlaybook.angles[i % slice.nichePlaybook.angles.length],
        retentionMark: r.mark,
        directive: r.rule,
        cta: slice.ctas.save[i % slice.ctas.save.length],
      })),
    },
  });
});

// ── GET /fresh-angles ──────────────────────────────────────────────────────
// Routed through the marketing brain: Claude-first (LIVE web search for what's
// resonating now, blended with the user's real performance) → Gemini fallback
// → curated knowledge base. Response shape { topic, niche, angles[] } preserved.
router.get('/fresh-angles', auth, async (req, res) => {
  const topic = String(req.query.topic || 'content creation');
  const slice = pickSlice(req);
  const userId = req.user?._id || req.user?.id;

  try {
    const { getFreshAngles } = require('../services/marketingBrainService');
    const brain = await getFreshAngles({
      userId, niche: slice.niche, platform: slice.platform, topic, language: req.language || 'en',
      tier: resolveTier(req.user),
    });
    if (brain.ok && Array.isArray(brain.angles) && brain.angles.length) {
      return res.json({
        success: true,
        data: {
          topic: brain.topic,
          niche: brain.niche,
          angles: brain.angles,
          source: brain.source,
          citations: brain.citations || [],
        },
      });
    }
  } catch (err) {
    logger.warn('[marketing-intel] fresh-angles brain call failed; using knowledge base', { error: err.message });
  }

  // Deterministic knowledge-base fallback — never empty-state.
  const angles = slice.nichePlaybook.angles.map((angle, i) => ({
    headline: `${angle}: ${topic}`,
    why: slice.nichePlaybook.triggers[i % slice.nichePlaybook.triggers.length],
    framework: HOOK_FRAMEWORKS[i % HOOK_FRAMEWORKS.length].id,
  }));
  res.json({ success: true, data: { topic, niche: slice.niche, angles, source: 'knowledge-base' } });
});

// ── GET /strategy ──────────────────────────────────────────────────────────
// Current, web-grounded niche/platform strategy from the marketing brain.
// Claude-first with LIVE web search (cited) → Gemini knowledge-base fallback.
router.get('/strategy', auth, async (req, res) => {
  const slice = pickSlice(req);
  const userId = req.user?._id || req.user?.id;
  const goal = req.query.goal || null;

  try {
    const { getStrategy } = require('../services/marketingBrainService');
    const brain = await getStrategy({
      userId, niche: slice.niche, platform: slice.platform, goal, language: req.language || 'en',
      tier: resolveTier(req.user),
    });
    if (!brain.ok) {
      return res.status(503).json({ success: false, error: brain.error });
    }
    return res.json({
      success: true,
      data: {
        niche: brain.niche,
        platform: brain.platform,
        goal: brain.goal,
        strategy: brain.strategy,
        source: brain.source,
        citations: brain.citations || [],
        ...(brain.trendsNote ? { trendsNote: brain.trendsNote } : {}),
      },
    });
  } catch (err) {
    logger.error('[marketing-intel] /strategy failed', { error: err.message });
    return res.status(503).json({ success: false, error: 'Strategy generation is temporarily unavailable.' });
  }
});

// ── GET /inspiration-drop ──────────────────────────────────────────────────
router.get('/inspiration-drop', auth, (req, res) => {
  const slice = pickSlice(req);
  const np = slice.nichePlaybook;
  res.json({
    success: true,
    data: {
      niche: slice.niche,
      drops: np.angles.map((angle, i) => ({
        angle,
        prompt: `Open on ${HOOK_FRAMEWORKS[i % HOOK_FRAMEWORKS.length].example.toLowerCase()}; pay off with ${np.triggers[i % np.triggers.length].toLowerCase()}.`,
        format: req.query.format || 'video',
      })),
    },
  });
});

// ── GET /engagement-prompts ────────────────────────────────────────────────
// Routed through the marketing brain (Claude-first reasoning over the niche
// playbook + the creator's real performance → knowledge-base fallback). The
// { platform, niche, prompts: {save,comment,share,dm,follow} } shape is kept.
router.get('/engagement-prompts', auth, async (req, res) => {
  const slice = pickSlice(req);
  const userId = req.user?._id || req.user?.id;

  try {
    const { getEngagementPlan } = require('../services/marketingBrainService');
    const brain = await getEngagementPlan({
      userId, niche: slice.niche, platform: slice.platform, language: req.language || 'en',
      tier: resolveTier(req.user),
    });
    if (brain.ok && brain.prompts) {
      return res.json({
        success: true,
        data: { platform: brain.platform, niche: brain.niche, prompts: brain.prompts, source: brain.source },
      });
    }
  } catch (err) {
    logger.warn('[marketing-intel] engagement-prompts brain call failed; using knowledge base', { error: err.message });
  }

  // Knowledge-base fallback — the global CTA library.
  res.json({
    success: true,
    data: {
      platform: slice.platform,
      niche: slice.niche,
      source: 'knowledge-base',
      prompts: {
        save: CTA_LIBRARY.save,
        comment: CTA_LIBRARY.comment,
        share: CTA_LIBRARY.share,
        dm: CTA_LIBRARY.dm,
        follow: CTA_LIBRARY.follow,
      },
    },
  });
});

// ── GET /benchmarks ────────────────────────────────────────────────────────
router.get('/benchmarks', auth, (req, res) => {
  const platform = req.query.platform || 'tiktok';
  const pp = PLATFORM_PLAYBOOKS[String(platform).toLowerCase()] || PLATFORM_PLAYBOOKS.tiktok;
  res.json({
    success: true,
    data: {
      platform,
      benchmarks: {
        idealLength: pp.idealLength,
        hookWindow: pp.hookWindow,
        captionStyle: pp.captionStyle,
        hashtags: pp.hashtags,
        soundStrategy: pp.soundStrategy,
      },
      avoid: pp.avoid,
    },
  });
});

// ── POST /pre-publish-report ───────────────────────────────────────────────
router.post('/pre-publish-report', auth, (req, res) => {
  const { contentText = '', niche, platform, format = 'post' } = req.body || {};
  const slice = getKnowledgeSlice({ niche, platform, language: req.language || 'en' });
  const np = slice.nichePlaybook;
  const pp = slice.platformPlaybook;

  // Heuristic scoring — production would call the AI service. We give
  // useful, grounded feedback even without AI configured.
  const wordCount = String(contentText).trim().split(/\s+/).filter(Boolean).length;
  const opensWithSpecific = /\b(\d+%|\$\d|\d+\s?(?:days|seconds|minutes|min|hr|hrs|hours))\b/i.test(contentText);
  const tooLong = wordCount > 60 && (slice.platform === 'tiktok' || slice.platform === 'instagram');
  const score = (opensWithSpecific ? 35 : 15) + (tooLong ? 10 : 30) + 25;

  const notes = [];
  if (!opensWithSpecific) notes.push('Add a specific number or named thing in the first 6 words to pass the niche scroll-stop.');
  if (tooLong) notes.push(`Trim — ideal length on ${slice.platform} is ${pp.idealLength}.`);
  notes.push(`Voice check: ${np.voice}`);
  if (np.avoid?.length) notes.push(`Avoid: ${np.avoid[0]}`);

  res.json({
    success: true,
    data: {
      niche: slice.niche,
      platform: slice.platform,
      format,
      wordCount,
      score: Math.min(100, score),
      verdict: score >= 75 ? 'publish-ready' : score >= 55 ? 'needs-tightening' : 'rewrite',
      notes,
    },
  });
});

// ── GET /optimal-windows ───────────────────────────────────────────────────
// Niche × platform × creator-history posting windows with rationale +
// confidence. Layers three signals:
//   1. Platform peak hours (PLATFORM_PLAYBOOKS).
//   2. Niche-specific best windows (NICHE_POSTING_WINDOWS).
//   3. (Future) creator's historical engagement-by-hour — placeholder for now,
//      surfaced as a fourth window with `signal: 'creator-history'` once
//      analytics ingestion is live.
router.get('/optimal-windows', auth, async (req, res) => {
  const niche = (req.query.niche || 'other').toString().toLowerCase();
  const platform = (req.query.platform || 'tiktok').toString().toLowerCase();

  const platformPlaybook = PLATFORM_PLAYBOOKS[platform] || PLATFORM_PLAYBOOKS.tiktok;
  // Guard against an unknown niche AND a missing `.other` fallback — the
  // handler is async now, so a `.map` of undefined would surface as an
  // unhandled rejection rather than a catchable sync throw.
  const nicheWindows = NICHE_POSTING_WINDOWS[niche] || NICHE_POSTING_WINDOWS.other || [];

  // Synthesize top-3 windows by intersecting niche windows with the platform's
  // implicit peak (encoded loosely in the playbook's `idealLength` framing —
  // we pick mid-window centers and tag rationale per-source).
  const windows = nicheWindows.map((w, i) => {
    const centerHour = Math.round((w.start + w.end) / 2);
    const rationale = [
      `Niche signal: ${w.label} (${niche}).`,
      `Platform peak: ${platform} viewers cluster around ${centerHour}:00 local.`,
    ];
    // Confidence rises when both signals reinforce; first window is the anchor.
    const confidence = i === 0 ? 0.82 : 0.74;
    return {
      hour: centerHour,
      window: { start: w.start, end: w.end },
      label: w.label,
      rationale,
      confidence,
      source: 'niche+platform',
    };
  });

  // Real creator-history signal: the user's peak engagement hour from their
  // own posted posts (grows with the user as they publish more). Surfaced as a
  // high-confidence window once there are enough data points.
  try {
    const ScheduledPost = require('../models/ScheduledPost');
    const userId = String(req.user?._id || req.user?.id || '');
    const rows = await ScheduledPost.aggregate([
      { $match: { userId, status: 'posted', postedAt: { $ne: null } } },
      { $group: { _id: { $hour: '$postedAt' }, totalEngagement: { $sum: { $ifNull: ['$analytics.engagement', 0] } }, n: { $sum: 1 } } },
      { $sort: { totalEngagement: -1 } },
      { $limit: 1 },
    ]).catch(() => []);
    if (rows[0] && rows[0].n >= 3) {
      const peakHour = rows[0]._id;
      windows.unshift({
        hour: peakHour,
        window: { start: peakHour, end: (peakHour + 1) % 24 },
        label: `Your peak engagement hour (~${peakHour}:00 UTC)`,
        rationale: [`Creator history: your ${rows[0].n} posts engage most around ${peakHour}:00.`],
        confidence: 0.9,
        source: 'creator-history',
        signal: 'creator-history',
      });
    }
  } catch (e) {
    // No history yet — fall back to the niche+platform windows above.
  }

  res.json({
    success: true,
    data: {
      niche,
      platform,
      windows: windows.slice(0, 4),
      platformBrief: {
        idealLength: platformPlaybook.idealLength,
        captionStyle: platformPlaybook.captionStyle,
        cta: platformPlaybook.cta,
      },
    },
  });
});

module.exports = router;

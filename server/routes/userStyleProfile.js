/**
 * /api/style-profile — read & write Click's per-user taste graph.
 *
 * Endpoints
 *   GET  /api/style-profile           Return current user's profile (created on first read).
 *   POST /api/style-profile/pick      Body: { facet, key } — increment a counter.
 *   POST /api/style-profile/average   Body: { key, value } — update a running average.
 *   POST /api/style-profile/batch     Body: { picks: [{facet,key}], averages: [{key,value}] }
 */

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const UserStyleProfile = require('../models/UserStyleProfile');
const { isDevUser } = require('../utils/devUser');
const { getUserIdFromReq } = require('../utils/userId');

const router = express.Router();

// Supabase users have UUID ids that Mongoose can't cast to ObjectId. When we
// see one, return an empty taste graph instead of 500-ing the whole editor.
const EMPTY_INSIGHTS = {
  topPerformers: { fonts: [], captionStyles: [], animations: [], motions: [], hooks: [] },
  lastIngestedAt: null,
};
function isMongoId(id) { return mongoose.Types.ObjectId.isValid(String(id)); }

// Dev-mode in-memory profile so the editor can record picks without Mongo.
const devProfiles = new Map();

function getDevProfile(userId) {
  let p = devProfiles.get(userId);
  if (!p) {
    p = {
      userId,
      fonts: [], captionStyles: [], animations: [], motions: [],
      colorGrades: [], transitions: [], niches: [], platforms: [],
      averages: { avgCutDuration: null, avgFontSize: null, avgCaptionLength: null, avgVideoDuration: null },
      totalPicks: 0,
    };
    devProfiles.set(userId, p);
  }
  return p;
}

function devRecordPick(userId, facet, key) {
  const p = getDevProfile(userId);
  if (!p[facet]) return null;
  let counter = p[facet].find(c => c.key === key);
  if (counter) {
    counter.count += 1;
    counter.lastUsedAt = new Date().toISOString();
  } else {
    p[facet].push({ key, count: 1, lastUsedAt: new Date().toISOString() });
  }
  p.totalPicks += 1;
  return p;
}

function devRecordAverage(userId, key, value) {
  const p = getDevProfile(userId);
  if (!(key in p.averages)) return null;
  const current = p.averages[key];
  p.averages[key] = current == null ? value : current * 0.7 + value * 0.3;
  return p;
}

function devResetProfile(userId, facet) {
  const p = getDevProfile(userId);
  if (facet) {
    if (facet === 'totalPicks') {
      p.totalPicks = 0;
    } else if (facet === 'averages') {
      p.averages = { avgCutDuration: null, avgFontSize: null, avgCaptionLength: null, avgVideoDuration: null };
    } else if (facet in p && Array.isArray(p[facet])) {
      p[facet] = [];
    }
  } else {
    devProfiles.delete(userId);
  }
  return getDevProfile(userId);
}

// ── Routes ────────────────────────────────────────────────────────────────

router.get('/', auth, async (req, res) => {
  try {
    // Canonical user-id resolver — same one publish/learnFromPublishedClip
    // uses. Was previously `req.user?._id || req.user?.id`, which returned
    // ObjectId-instance vs string inconsistently and meant the GET handler
    // hit a different userId than the write path for some users. The
    // observable symptom: publish reports `learned: true` and the
    // style-insight endpoint shows the facets, but /api/style-profile
    // returns an empty profile + creates a duplicate doc.
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    if (isDevUser(req.user)) {
      return res.json({ success: true, data: getDevProfile(String(userId)) });
    }

    // Supabase users (UUIDs) — use the in-memory dev profile so picks still work.
    if (!isMongoId(userId)) {
      return res.json({ success: true, data: getDevProfile(String(userId)) });
    }

    // .lean() bypasses Mongoose document hydration so we get the raw DB
    // values. Without it we were seeing a doc with the correct _id but
    // stale `totalPicks: 0` / empty facet arrays — even though the same
    // _id in the underlying collection had the populated fields. The
    // most likely cause is hydration of a previously-cached query result
    // for that _id; .lean() eliminates the cache layer entirely.
    // .read('primary') makes sure we don't read from a stale Atlas
    // secondary right after a write.
    // Atomic upsert avoids a find-then-create race on the unique userId index.
    // .read('primary') + new:true returns the up-to-date doc, never a stale read.
    // Concurrency guard: if two requests hit upsert simultaneously, catch E11000 and find the existing doc.
    let profile;
    try {
      profile = await UserStyleProfile.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).read('primary').lean();
    } catch (upsertErr) {
      if (upsertErr.code === 11000 || (upsertErr.message && upsertErr.message.includes('E11000'))) {
        profile = await UserStyleProfile.findOne({ userId }).read('primary').lean();
      } else {
        throw upsertErr;
      }
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('[style-profile] GET failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pick', auth, async (req, res) => {
  try {
    const { facet, key } = req.body || {};
    if (!facet || !key) return res.status(400).json({ success: false, error: 'facet and key are required' });

    // Canonical user-id resolver — same one publish/learnFromPublishedClip
    // uses. Was previously `req.user?._id || req.user?.id`, which returned
    // ObjectId-instance vs string inconsistently and meant the GET handler
    // hit a different userId than the write path for some users. The
    // observable symptom: publish reports `learned: true` and the
    // style-insight endpoint shows the facets, but /api/style-profile
    // returns an empty profile + creates a duplicate doc.
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    if (isDevUser(req.user) || !isMongoId(userId)) {
      const profile = devRecordPick(String(userId), facet, key);
      return res.json({ success: true, data: profile });
    }

    const profile = await UserStyleProfile.recordPick(userId, facet, key);
    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('[style-profile] pick failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/average', auth, async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key || typeof value !== 'number') {
      return res.status(400).json({ success: false, error: 'key and numeric value are required' });
    }
    // Canonical user-id resolver — same one publish/learnFromPublishedClip
    // uses. Was previously `req.user?._id || req.user?.id`, which returned
    // ObjectId-instance vs string inconsistently and meant the GET handler
    // hit a different userId than the write path for some users. The
    // observable symptom: publish reports `learned: true` and the
    // style-insight endpoint shows the facets, but /api/style-profile
    // returns an empty profile + creates a duplicate doc.
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    if (isDevUser(req.user) || !isMongoId(userId)) {
      const profile = devRecordAverage(String(userId), key, value);
      return res.json({ success: true, data: profile });
    }

    const profile = await UserStyleProfile.recordAverage(userId, key, value);
    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('[style-profile] average failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batch', auth, async (req, res) => {
  try {
    const { picks = [], averages = [] } = req.body || {};
    // Canonical user-id resolver — same one publish/learnFromPublishedClip
    // uses. Was previously `req.user?._id || req.user?.id`, which returned
    // ObjectId-instance vs string inconsistently and meant the GET handler
    // hit a different userId than the write path for some users. The
    // observable symptom: publish reports `learned: true` and the
    // style-insight endpoint shows the facets, but /api/style-profile
    // returns an empty profile + creates a duplicate doc.
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    const dev = isDevUser(req.user) || !isMongoId(userId);

    let profile = null;
    for (const p of picks) {
      if (!p?.facet || !p?.key) continue;
      profile = dev
        ? devRecordPick(String(userId), p.facet, p.key)
        : await UserStyleProfile.recordPick(userId, p.facet, p.key);
    }
    for (const a of averages) {
      if (!a?.key || typeof a?.value !== 'number') continue;
      profile = dev
        ? devRecordAverage(String(userId), a.key, a.value)
        : await UserStyleProfile.recordAverage(userId, a.key, a.value);
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('[style-profile] batch failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/style-profile/ingest-post ──────────────────────────────────
// Closes the continuous-learning loop. Body: { contentId, metrics }.
// metrics may include retentionRate, completionRate, viewCount, likes,
// shares, comments, benchmarkRetention. Updates the user's weighted style
// profile via creatorPerformanceService so subsequent /insights calls
// reflect the new retention deltas.
router.post('/ingest-post', auth, async (req, res) => {
  try {
    // Canonical user-id resolver — same one publish/learnFromPublishedClip
    // uses. Was previously `req.user?._id || req.user?.id`, which returned
    // ObjectId-instance vs string inconsistently and meant the GET handler
    // hit a different userId than the write path for some users. The
    // observable symptom: publish reports `learned: true` and the
    // style-insight endpoint shows the facets, but /api/style-profile
    // returns an empty profile + creates a duplicate doc.
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    const { contentId, metrics } = req.body || {};
    if (!contentId) return res.status(400).json({ success: false, error: 'contentId required' });

    // Ownership gate — prevents a user from polluting another user's style
    // profile by submitting fake metrics against arbitrary contentIds.
    const { guardOwnership } = require('../utils/ownership');
    const owned = await guardOwnership(req, res, contentId);
    if (!owned) return;

    if (isDevUser(req.user) || !isMongoId(userId)) {
      // Dev-mode / Supabase-UUID mock — confirm the call shape without touching Mongo.
      const delta = (metrics?.retentionRate ?? metrics?.completionRate ?? 0.55) - (metrics?.benchmarkRetention ?? 0.55);
      return res.json({
        success: true,
        data: { devMock: true, contentId, delta, updated: 4, picks: 4 },
      });
    }

    const { ingestPostPerformance } = require('../services/creatorPerformanceService');
    const result = await ingestPostPerformance({ userId, contentId, metrics });
    res.json({ success: true, data: { contentId, ...result } });
  } catch (err) {
    logger.error('[style-profile] ingest-post failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/style-profile/insights ──────────────────────────────────────
// Returns the user's top-performing style picks across each weighted facet,
// plus the timestamp of the last analytics ingestion. The editor's
// PerformanceRail uses this to show "what's working for you" and to bias
// suggestion-tile order toward picks with high retention deltas.
router.get('/insights', auth, async (req, res) => {
  try {
    // Canonical user-id resolver — same one publish/learnFromPublishedClip
    // uses. Was previously `req.user?._id || req.user?.id`, which returned
    // ObjectId-instance vs string inconsistently and meant the GET handler
    // hit a different userId than the write path for some users. The
    // observable symptom: publish reports `learned: true` and the
    // style-insight endpoint shows the facets, but /api/style-profile
    // returns an empty profile + creates a duplicate doc.
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    // Optional niche/platform filters — when present, also fold in the
    // performance-weighted playbook from getTopPerformingPlaybook (which
    // reads ScheduledPost.analytics + the Mongo profile and works for
    // Supabase users too).
    const niche = typeof req.query.niche === 'string' ? req.query.niche : null;
    const platform = typeof req.query.platform === 'string' ? req.query.platform : null;
    const { getTopPerformingPlaybook } = require('../services/marketingKnowledge');

    // Fetch the niche/platform-scoped top performers in parallel with the
    // profile read. Both are best-effort — a failure on either side falls
    // back to an empty payload.
    const performancePromise = getTopPerformingPlaybook(userId, niche, platform).catch(() => null);

    if (isDevUser(req.user)) {
      // Dev mode — return a deterministic mock so the UI renders without Mongo.
      const performance = await performancePromise;
      return res.json({
        success: true,
        data: {
          topPerformers: {
            fonts:         [{ key: 'var(--font-inter), Inter, system-ui, sans-serif', performanceScore: 0.18, sampleSize: 4 }],
            captionStyles: [{ key: 'bold-kinetic', performanceScore: 0.22, sampleSize: 5 }],
            animations:    [{ key: 'pop', performanceScore: 0.14, sampleSize: 3 }],
            motions:       [{ key: 'shake', performanceScore: 0.09, sampleSize: 2 }],
            hooks:         [{ key: 'curiosity-gap', performanceScore: 0.27, sampleSize: 4 }],
          },
          performance,
          lastIngestedAt: new Date().toISOString(),
          devMock: true,
        },
      });
    }

    // Supabase users (UUIDs) — no Mongo profile, but ScheduledPost.analytics
    // IS available, so we return performance data (when sampleSize ≥ 3) and
    // an otherwise empty topPerformers map. Cold-start users get `null` for
    // performance, which the client renders as "publish a few clips to see
    // what's working".
    if (!isMongoId(userId)) {
      const performance = await performancePromise;
      return res.json({
        success: true,
        data: { ...EMPTY_INSIGHTS, performance },
      });
    }

    // Atomic upsert — a find-then-create race (two concurrent GETs both see no
    // profile and both create) hit the unique userId index with E11000.
    const profile = await UserStyleProfile.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const performance = await performancePromise;
    res.json({
      success: true,
      data: {
        topPerformers: {
          fonts:         profile.topPerformers('weightedFonts', 5),
          captionStyles: profile.topPerformers('weightedCaptionStyles', 5),
          animations:    profile.topPerformers('weightedAnimations', 5),
          motions:       profile.topPerformers('weightedMotions', 5),
          colorGrades:   profile.topPerformers('weightedColorGrades', 5),
          transitions:   profile.topPerformers('weightedTransitions', 5),
          hooks:         profile.topPerformers('weightedHooks', 5),
        },
        // Performance-scoped block (niche/platform filtered when query
        // params provided). The editor uses this to bias preset-tile
        // ordering to what's working in THIS context, not just overall.
        performance,
        lastIngestedAt: profile.lastIngestedAt || null,
      },
    });
  } catch (err) {
    logger.error('[style-profile] insights failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/style-profile/recommendations ────────────────────────────────
// Returns an actionable, single-bundle style recommendation for AI avatar
// generation or video editor presets based on the user's top-performing
// facets and platform/niche context.
router.get('/recommendations', auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    let profile = null;
    if (isDevUser(req.user) || !isMongoId(userId)) {
      profile = getDevProfile(String(userId));
    } else {
      profile = await UserStyleProfile.findOne({ userId }).read('primary').lean();
    }

    const getTop = (arr) => Array.isArray(arr) && arr.length > 0
      ? [...arr].sort((a, b) => (b.count || 0) - (a.count || 0))[0]?.key
      : null;

    const recommendedFont = getTop(profile?.fonts) || 'Inter, system-ui, sans-serif';
    const recommendedCaptionStyle = getTop(profile?.captionStyles) || 'bold-kinetic';
    const recommendedColorGrade = getTop(profile?.colorGrades) || 'cinematic';
    const recommendedAnimation = getTop(profile?.animations) || 'pop';
    const recommendedMotion = getTop(profile?.motions) || 'dynamic-zoom';
    const recommendedHook = getTop(profile?.hookStyles) || 'curiosity-gap';
    const recommendedPreset = getTop(profile?.presets) || 'hormozi-bold';
    const avgCutDuration = profile?.averages?.avgCutDuration || 1.8;

    const totalPicks = profile?.totalPicks || 0;
    const confidence = totalPicks > 20 ? 0.95 : totalPicks > 5 ? 0.75 : totalPicks > 0 ? 0.5 : 0.2;

    res.json({
      success: true,
      data: {
        recommendedFont,
        recommendedCaptionStyle,
        recommendedColorGrade,
        recommendedAnimation,
        recommendedMotion,
        recommendedHook,
        recommendedPreset,
        avgCutDuration,
        confidence,
        totalPicks,
        isCalibrated: totalPicks >= 5,
      },
    });
  } catch (err) {
    logger.error('[style-profile] recommendations failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/style-profile/reset ─────────────────────────────────────────
// Resets a specific facet or the entire profile taste graph.
// Body: { facet?: string }
router.post('/reset', auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    const { facet } = req.body || {};
    const ALLOWED_FACETS = [
      'fonts', 'captionStyles', 'animations', 'motions',
      'colorGrades', 'transitions', 'hooks', 'presets', 'niches', 'platforms',
      'averages', 'totalPicks'
    ];
    if (facet && !ALLOWED_FACETS.includes(facet)) {
      return res.status(400).json({ success: false, error: `Invalid facet: '${facet}'. Allowed facets: ${ALLOWED_FACETS.join(', ')}` });
    }

    if (isDevUser(req.user) || !isMongoId(userId)) {
      const resetP = devResetProfile(String(userId), facet);
      return res.json({ success: true, message: facet ? `Facet ${facet} reset` : 'Profile reset', data: resetP });
    }

    let profile;
    if (facet) {
      const update = {};
      if (facet === 'totalPicks') {
        update.totalPicks = 0;
        update.totalWeightedPicks = 0;
      } else if (facet === 'averages') {
        update.averages = { avgCutDuration: null, avgFontSize: null, avgCaptionLength: null, avgVideoDuration: null };
      } else {
        update[facet] = [];
        const weightedFacet = `weighted${facet.charAt(0).toUpperCase()}${facet.slice(1)}`;
        update[weightedFacet] = [];
      }
      profile = await UserStyleProfile.findOneAndUpdate({ userId }, { $set: update }, { new: true, lean: true });
    } else {
      await UserStyleProfile.findOneAndDelete({ userId });
      profile = await UserStyleProfile.create({ userId });
    }

    res.json({
      success: true,
      message: facet ? `Facet '${facet}' has been reset` : 'Taste profile reset successfully',
      data: profile,
    });
  } catch (err) {
    logger.error('[style-profile] reset failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

/**
 * creatorPerformanceService.js — closes the editor's continuous-learning loop.
 *
 * Given a published post + its post-publish engagement metrics, this module
 * looks up the project content used in the post, derives which style picks
 * (fonts, caption styles, animations, motions, color grades, transitions,
 * hooks) were on screen, and updates UserStyleProfile.recordPerformance for
 * each. The editor reads the resulting `weighted*` arrays via
 * `/style-profile/insights` and re-ranks suggestion tiles toward what worked.
 *
 * Inputs
 *   userId        ObjectId — owner of the project
 *   contentId     string   — Click content (project) id; resolves through devStore + Mongo
 *   metrics       { retentionRate, completionRate, viewCount, likes, shares, comments,
 *                   benchmarkRetention?, benchmarkCompletion? }
 *
 * The retention delta vs. the niche/platform benchmark is used as the
 * performance signal; values are clamped to [-1, 1].
 */

const logger = require('../utils/logger');
const UserStyleProfile = require('../models/UserStyleProfile');
const { resolveContent } = require('../utils/devStore');

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/**
 * Compute retention delta from raw metrics. Falls back to a normalised
 * completion-rate score when no benchmark is available so the signal is
 * still meaningful for early-career creators.
 */
function computeRetentionDelta(metrics = {}) {
  const benchmark = metrics.benchmarkRetention ?? metrics.benchmarkCompletion ?? 0.55;
  const retention = metrics.retentionRate ?? metrics.completionRate ?? null;
  if (typeof retention !== 'number') return 0;
  return clamp(retention - benchmark, -1, 1);
}

/**
 * Walk the project's overlays/segments and yield distinct (facet, key) pairs
 * representing every style choice on screen. We don't time-slice picks
 * against retention curves yet (out of scope for v1) — the post-level signal
 * is applied uniformly to every visible pick.
 */
function extractPicks(content) {
  const picks = [];
  const seen = new Set();
  const add = (facet, key) => {
    if (!key) return;
    const tag = `${facet}::${key}`;
    if (seen.has(tag)) return;
    seen.add(tag);
    picks.push({ facet, key });
  };

  const overlays = content?.textOverlays || content?.metadata?.textOverlays || [];
  for (const o of overlays) {
    add('weightedFonts', o.fontFamily);
    add('weightedCaptionStyles', o.style);
    add('weightedAnimations', o.animationIn);
    add('weightedMotions', o.motionGraphic);
  }
  const grade = content?.metadata?.colorGrade || content?.metadata?.captionStyle?.colorGrade;
  if (grade) add('weightedColorGrades', grade);
  const transitions = content?.metadata?.transitions || [];
  for (const t of transitions) add('weightedTransitions', t);
  const hookId = content?.metadata?.hookFrameworkId || content?.metadata?.hookId;
  if (hookId) add('weightedHooks', hookId);
  return picks;
}

/**
 * Ingest one post's performance and update the user's style profile.
 * Returns the count of facet/key updates so callers can log progress.
 */
async function ingestPostPerformance({ userId, contentId, metrics } = {}) {
  if (!userId || !contentId) throw new Error('userId and contentId required');
  const content = await resolveContent(contentId);
  if (!content) {
    logger.warn('[creatorPerformance] content not found', { contentId });
    return { updated: 0 };
  }

  const delta = computeRetentionDelta(metrics);
  const picks = extractPicks(content);
  if (picks.length === 0) {
    logger.info('[creatorPerformance] no style picks on content', { contentId });
    return { updated: 0, delta };
  }

  let updated = 0;
  for (const p of picks) {
    try {
      await UserStyleProfile.recordPerformance(userId, p.facet, p.key, delta);
      updated += 1;
    } catch (e) {
      logger.warn('[creatorPerformance] recordPerformance failed', {
        userId, facet: p.facet, key: p.key, error: e.message,
      });
    }
  }
  return { updated, delta, picks: picks.length };
}

/**
 * Batch-ingest a list of posts. Useful for backfill admin endpoints. Each
 * post is processed independently — one failure doesn't block the rest.
 */
async function ingestBatch(posts = []) {
  let total = 0;
  for (const p of posts) {
    try {
      const r = await ingestPostPerformance(p);
      total += r.updated || 0;
    } catch (e) {
      logger.warn('[creatorPerformance] batch item failed', { error: e.message });
    }
  }
  return { total, postsProcessed: posts.length };
}

module.exports = {
  ingestPostPerformance,
  ingestBatch,
  computeRetentionDelta,
  extractPicks,
};

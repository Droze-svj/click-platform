// Retention → Edit — the differentiator vidIQ can't touch. vidIQ SHOWS you a
// retention graph; this turns the curve into concrete EDIT decisions: where
// viewers leave (cut/tighten), where they rewatch (lead with / clip), and how
// strong the hook is. PURE analyzer (unit-tested); feeds the editor + auto-clip.

const logger = require('../utils/logger');

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0)); }

/**
 * PURE: analyze a retention curve [{ second, percentage }] (viewers still
 * watching) → { avgViewPercent, hookScore, dropOffs, rewatchPeaks, recommendations }.
 */
function analyzeRetention(curve = [], options = {}) {
  const pts = (Array.isArray(curve) ? curve : [])
    .map((p) => ({ s: Number(p && p.second), pct: Number(p && p.percentage) }))
    .filter((p) => Number.isFinite(p.s) && Number.isFinite(p.pct))
    .sort((a, b) => a.s - b.s);

  if (pts.length < 2) {
    return { avgViewPercent: pts[0] ? Math.round(pts[0].pct) : 0, hookScore: 0, dropOffs: [], rewatchPeaks: [], recommendations: [], reason: 'insufficient_data' };
  }

  const avgViewPercent = Math.round(pts.reduce((a, p) => a + p.pct, 0) / pts.length);

  // retention value at-or-before a given second
  const at = (sec) => {
    let v = pts[0].pct;
    for (const p of pts) { if (p.s <= sec) v = p.pct; else break; }
    return v;
  };
  const start = pts[0].pct || 100;
  const r3 = at(3);
  const hookScore = Math.round(clamp(start > 0 ? (r3 / start) * 100 : 0));

  const dropThreshold = Number(options.dropThreshold) || 5;
  const dropOffs = [];
  for (let i = 1; i < pts.length; i++) {
    const drop = pts[i - 1].pct - pts[i].pct;
    if (drop >= dropThreshold) {
      const severity = drop >= 15 ? 'high' : drop >= 8 ? 'medium' : 'low';
      dropOffs.push({
        second: pts[i].s,
        dropPct: Math.round(drop),
        severity,
        recommendation: `Viewers drop ${Math.round(drop)}% around ${pts[i].s}s — tighten or cut this beat.`,
      });
    }
  }
  dropOffs.sort((a, b) => b.dropPct - a.dropPct);

  const rewatchPeaks = [];
  for (let i = 1; i < pts.length; i++) {
    const gain = pts[i].pct - pts[i - 1].pct;
    if (gain > 2) rewatchPeaks.push({ second: pts[i].s, gainPct: Math.round(gain) });
  }
  rewatchPeaks.sort((a, b) => b.gainPct - a.gainPct);

  const recommendations = [];
  if (hookScore < 70) {
    recommendations.push({ type: 'hook', priority: 'high', message: `Weak hook — ${100 - hookScore}% leave in the first 3s. Lead with a stronger pattern interrupt or your best moment.` });
  }
  if (dropOffs[0]) recommendations.push({ type: 'cut', priority: dropOffs[0].severity, second: dropOffs[0].second, message: dropOffs[0].recommendation });
  if (rewatchPeaks[0]) recommendations.push({ type: 'lead', priority: 'medium', second: rewatchPeaks[0].second, message: `Viewers rewatch around ${rewatchPeaks[0].second}s — lead with this moment or clip it.` });
  if (avgViewPercent >= 50) recommendations.push({ type: 'strength', priority: 'low', message: `Strong average view (${avgViewPercent}%) — replicate this structure.` });

  return { avgViewPercent, hookScore, dropOffs, rewatchPeaks, recommendations };
}

/**
 * Orchestrator: load a video's real retention curve and analyze it. Ownership is
 * grounded on Content (which carries userId) — VideoMetrics is keyed by
 * workspaceId/contentId only, so authorizing on the metrics doc would be a no-op
 * (and naively querying by contentId alone would be a cross-tenant IDOR).
 */
async function getRetentionInsights(contentId, userId, options = {}) {
  const VideoMetrics = require('../models/VideoMetrics');
  const Content = require('../models/Content');

  const content = await Content.findById(contentId).select('userId').lean().catch(() => null);
  if (!content) return { available: false, reason: 'no_content', contentId };
  if (userId && String(content.userId) !== String(userId)) return { available: false, reason: 'not_found', contentId };

  let doc = null;
  try {
    doc = await VideoMetrics.findOne({ contentId }).select('retention platform').sort({ createdAt: -1 }).lean();
  } catch (err) {
    logger.warn('[retention] metrics query failed', { error: err.message });
  }

  // Local-first: use the stored curve when we have one.
  const localCurve = (doc && doc.retention && doc.retention.curve) || [];
  if (localCurve.length >= 2) {
    const analysis = analyzeRetention(localCurve, options);
    return { available: true, source: 'local', contentId, platform: doc.platform, ...analysis };
  }

  // Fallback: pull LIVE YouTube retention for a published YouTube video. Mapped
  // to { second, percentage } via the video duration. Honest at every step.
  try {
    const live = await getLiveYouTubeRetention(contentId, userId, options);
    if (live && Array.isArray(live.curve) && live.curve.length >= 2) {
      const analysis = analyzeRetention(live.curve, options);
      return { available: true, source: 'youtube_live', contentId, platform: 'youtube', durationSec: live.durationSec, ...analysis };
    }
  } catch (err) {
    logger.warn('[retention] live YouTube fallback failed', { error: err.message });
  }

  return { available: false, reason: 'no_metrics', contentId };
}

/** Resolve a content's published YouTube videoId, then fetch+map its live curve. */
async function getLiveYouTubeRetention(contentId, userId, options = {}) {
  const ScheduledPost = require('../models/ScheduledPost');
  const yt = require('./youtubeAnalyticsService');
  const sp = await ScheduledPost.findOne({
    contentId, platform: 'youtube', platformPostId: { $nin: [null, ''] },
  }).select('platformPostId').sort({ postedAt: -1 }).lean().catch(() => null);
  if (!sp || !sp.platformPostId) return null;
  return yt.getMappedVideoRetention(userId, sp.platformPostId, { accountId: options.accountId || null });
}

/**
 * Retention insights for an EXTERNAL video (one synced from the channel, not
 * necessarily published through Click). Ownership is grounded on SocialVideo;
 * the curve comes live from YouTube. Honest available:false at each missing step.
 */
async function getExternalVideoRetention(externalId, userId, options = {}) {
  const SocialVideo = require('../models/SocialVideo');
  const yt = require('./youtubeAnalyticsService');

  const sv = await SocialVideo.findOne({ userId: String(userId), externalId: String(externalId) })
    .select('externalId accountId platform title').lean().catch(() => null);
  if (!sv) return { available: false, reason: 'not_found', externalId };

  const mapped = await yt.getMappedVideoRetention(userId, sv.externalId, {
    accountId: options.accountId || sv.accountId || null,
  }).catch(() => null);
  const curve = mapped && Array.isArray(mapped.curve) ? mapped.curve : [];
  if (curve.length < 2) return { available: false, reason: 'no_retention', externalId, title: sv.title };

  const analysis = analyzeRetention(curve, options);
  return { available: true, source: 'youtube_live', externalId, title: sv.title, durationSec: mapped.durationSec, ...analysis };
}

module.exports = { analyzeRetention, getRetentionInsights, getExternalVideoRetention };

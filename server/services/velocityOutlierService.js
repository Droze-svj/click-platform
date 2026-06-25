// Velocity (views-per-hour) + outlier detection — vidIQ's VPH + "which videos
// are overperforming". PURE cores (deterministic, unit-tested); the orchestrator
// reads real VideoMetrics. Outliers are measured against the CREATOR'S OWN
// baseline (median), so it surfaces "do more of this" honestly per channel.

const logger = require('../utils/logger');

function clampNum(n) { return Number.isFinite(Number(n)) ? Number(n) : 0; }

/**
 * PURE: views-per-hour from time-ordered snapshots [{ at, views }]. Returns the
 * overall VPH plus a recent-window VPH + trend (accelerating/steady/cooling).
 */
function computeVelocity(snapshots = []) {
  const pts = (Array.isArray(snapshots) ? snapshots : [])
    .map((s) => ({ t: new Date(s && s.at).getTime(), v: clampNum(s && s.views) }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return { vph: 0, recentVph: 0, trend: 'flat', points: pts.length, totalViews: pts[0] ? pts[0].v : 0 };

  const first = pts[0];
  const last = pts[pts.length - 1];
  const hours = (last.t - first.t) / 3600000;
  const overallVph = hours > 0 ? (last.v - first.v) / hours : 0;

  const prev = pts[pts.length - 2];
  const recentHours = (last.t - prev.t) / 3600000;
  const recentVph = recentHours > 0 ? (last.v - prev.v) / recentHours : overallVph;

  const trend = recentVph > overallVph * 1.15 ? 'accelerating'
    : recentVph < overallVph * 0.85 ? 'cooling' : 'steady';

  return {
    vph: Math.round(overallVph),
    recentVph: Math.round(recentVph),
    trend,
    points: pts.length,
    totalViews: last.v,
  };
}

/** PURE: average VPH since publish — single-point fallback when there's no series. */
function velocityFromPublish(publishedAt, views, now) {
  const start = new Date(publishedAt).getTime();
  const nowMs = Number.isFinite(now) ? now : new Date(now).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(nowMs) || nowMs <= start) return 0;
  const hours = (nowMs - start) / 3600000;
  return hours > 0 ? Math.round(clampNum(views) / hours) : 0;
}

/**
 * PURE: flag overperformers / underperformers vs the creator's OWN median for a
 * metric. Returns the baseline, each video's multiplier (× median), and the
 * ranked outliers. Needs ≥3 videos to have a meaningful baseline.
 */
function detectOutliers(videos = [], options = {}) {
  const metric = options.metric || 'views';
  const overMultiplier = Number(options.overMultiplier) || 2;
  const underMultiplier = Number(options.underMultiplier) || 0.4;

  const list = (Array.isArray(videos) ? videos : []).filter((v) => v && Number.isFinite(Number(v[metric])));
  if (list.length < 3) return { baseline: null, metric, outliers: [], underperformers: [], count: list.length, reason: 'insufficient_data' };

  const values = list.map((v) => Number(v[metric])).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

  const scored = list.map((v) => ({
    ...v,
    metricValue: Number(v[metric]),
    multiplier: median > 0 ? Math.round((Number(v[metric]) / median) * 100) / 100 : 0,
  }));

  const outliers = scored.filter((v) => v.multiplier >= overMultiplier).sort((a, b) => b.multiplier - a.multiplier);
  const underperformers = scored.filter((v) => v.multiplier <= underMultiplier).sort((a, b) => a.multiplier - b.multiplier);

  return { baseline: median, metric, outliers, underperformers, count: list.length };
}

/**
 * Orchestrator: surface the creator's overperformers vs their OWN baseline.
 * Ownership is grounded on Content (VideoMetrics is keyed by workspaceId/
 * contentId only); we read the user's Content, then join VideoMetrics by
 * contentId. Content.createdAt is the publish-time proxy for VPH. `nowMs` is
 * injectable for tests.
 */
async function getOutliers(userId, options = {}) {
  const VideoMetrics = require('../models/VideoMetrics');
  const Content = require('../models/Content');
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();

  const limit = Math.max(1, Math.min(Number(options.limit) || 200, 1000));
  let contents = [];
  try {
    contents = await Content.find({ userId })
      .select('_id createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    logger.warn('[velocityOutlier] content query failed', { error: err.message });
    return { baseline: null, outliers: [], underperformers: [], count: 0, available: false };
  }
  if (!contents.length) return { baseline: null, outliers: [], underperformers: [], count: 0, available: false };

  const publishById = new Map(contents.map((c) => [String(c._id), c.createdAt]));
  let docs = [];
  try {
    docs = await VideoMetrics.find({ contentId: { $in: contents.map((c) => c._id) } })
      .select('contentId platform views createdAt')
      .lean();
  } catch (err) {
    logger.warn('[velocityOutlier] metrics query failed', { error: err.message });
    return { baseline: null, outliers: [], underperformers: [], count: 0, available: false };
  }

  // A content can have multiple VideoMetrics docs (one per platform/post).
  // Aggregate by contentId so a multi-platform repost isn't counted N times in
  // the baseline median.
  const byContent = new Map();
  for (const d of (docs || [])) {
    const cid = String(d.contentId);
    const views = (d.views && (d.views.total || d.views.unique)) || 0;
    const publishedAt = publishById.get(cid) || d.createdAt;
    const cur = byContent.get(cid);
    if (cur) {
      cur.views += views;
      if (publishedAt && (!cur.publishedAt || new Date(publishedAt) < new Date(cur.publishedAt))) cur.publishedAt = publishedAt;
      if (d.platform && !cur.platforms.includes(d.platform)) cur.platforms.push(d.platform);
    } else {
      byContent.set(cid, { contentId: d.contentId, platforms: d.platform ? [d.platform] : [], views, publishedAt });
    }
  }
  const videos = Array.from(byContent.values()).map((v) => ({
    contentId: v.contentId,
    platform: v.platforms[0] || null,
    platforms: v.platforms,
    views: v.views,
    vph: velocityFromPublish(v.publishedAt, v.views, nowMs),
    publishedAt: v.publishedAt,
  }));

  const result = detectOutliers(videos, { metric: 'views', overMultiplier: options.overMultiplier, underMultiplier: options.underMultiplier });
  return { ...result, available: videos.length >= 3 };
}

module.exports = { computeVelocity, velocityFromPublish, detectOutliers, getOutliers };

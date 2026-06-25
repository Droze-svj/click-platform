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
 * Orchestrator: read the creator's real VideoMetrics, compute average VPH per
 * video, and surface outliers vs their own baseline. `nowMs` is injectable for
 * tests (no ambient Date in the pure path).
 */
async function getOutliers(userId, options = {}) {
  const VideoMetrics = require('../models/VideoMetrics');
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  let docs = [];
  try {
    docs = await VideoMetrics.find({ userId })
      .select('contentId platform views publishedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(Number(options.limit) || 100)
      .lean();
  } catch (err) {
    logger.warn('[velocityOutlier] metrics query failed', { error: err.message });
    return { baseline: null, outliers: [], underperformers: [], count: 0, available: false };
  }

  const videos = (docs || []).map((d) => {
    const views = (d.views && (d.views.total || d.views.unique)) || 0;
    const publishedAt = d.publishedAt || d.createdAt;
    return {
      contentId: d.contentId,
      platform: d.platform,
      views,
      vph: velocityFromPublish(publishedAt, views, nowMs),
      publishedAt,
    };
  });

  const result = detectOutliers(videos, { metric: 'views', overMultiplier: options.overMultiplier, underMultiplier: options.underMultiplier });
  return { ...result, available: videos.length >= 3 };
}

module.exports = { computeVelocity, velocityFromPublish, detectOutliers, getOutliers };

// Channel Audit — vidIQ's channel scorecard, native. A PURE auditor scores the
// channel on engagement, retention, cadence, growth, and metadata completeness
// into a 0–100 grade with fixes; the orchestrator pulls REAL data from
// youtubeAnalyticsService (honest unavailable when no channel is connected).

const logger = require('../utils/logger');

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0)); }

/**
 * PURE: audit a channel.
 *   input: { subscriberCount, metrics:{views,likes,comments,subscribersGained,averageViewDuration},
 *            videos:[{publishedAt, views, durationSec, hasThumbnail}] }
 * → { score, grade, subscriberCount, subscores, issues, strengths }
 */
function auditChannel(input = {}, options = {}) {
  const subs = Number(input.subscriberCount) || 0;
  const m = input.metrics || {};
  const videos = Array.isArray(input.videos) ? input.videos : [];
  const issues = [];
  const strengths = [];

  // ── Engagement ──
  const views = Number(m.views) || videos.reduce((a, v) => a + (Number(v && v.views) || 0), 0);
  const eng = (Number(m.likes) || 0) + (Number(m.comments) || 0);
  const engRate = views > 0 ? (eng / views) * 100 : 0;
  const engScore = clamp(Math.round((engRate / 5) * 100));
  if (engRate >= 4) strengths.push('Strong engagement rate.');
  else issues.push({ area: 'engagement', severity: 'medium', message: `Engagement rate ${engRate.toFixed(1)}% — aim for 4%+ with stronger hooks/CTAs.` });

  // ── Retention (avg view duration vs avg length) ──
  let retScore = 50;
  const avgView = Number(m.averageViewDuration) || 0;
  const avgLen = videos.length ? videos.reduce((a, v) => a + (Number(v && v.durationSec) || 0), 0) / videos.length : 0;
  if (avgView > 0 && avgLen > 0) {
    const pct = clamp((avgView / avgLen) * 100);
    retScore = Math.round(pct);
    if (pct >= 50) strengths.push('Healthy average view duration.');
    else issues.push({ area: 'retention', severity: 'high', message: `Avg view duration ~${Math.round(pct)}% — tighten intros (use the retention insights).` });
  }

  // ── Cadence ──
  let cadScore = 50;
  const dated = videos.map((v) => new Date(v && v.publishedAt).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  if (dated.length >= 2) {
    const weeks = Math.max(1, (dated[dated.length - 1] - dated[0]) / (7 * 86400000));
    const perWeek = dated.length / weeks;
    cadScore = perWeek >= 1 ? 100 : Math.round(perWeek * 100);
    if (perWeek >= 1) strengths.push(`Consistent cadence (~${perWeek.toFixed(1)}/week).`);
    else issues.push({ area: 'cadence', severity: 'medium', message: `Irregular cadence (~${perWeek.toFixed(1)}/week) — consistency compounds. Use Autopilot.` });
  }

  // ── Growth ──
  let growthScore = 50;
  const gained = Number(m.subscribersGained) || 0;
  if (gained > 0) { growthScore = 80; strengths.push(`+${gained} subscribers this period.`); }
  else issues.push({ area: 'growth', severity: 'medium', message: 'No subscriber growth this period — strengthen packaging + hooks.' });

  // ── Metadata completeness ──
  let metaScore = 60;
  if (videos.length) {
    const withThumb = videos.filter((v) => v && v.hasThumbnail).length / videos.length;
    metaScore = Math.round(withThumb * 100);
    if (withThumb < 0.8) issues.push({ area: 'metadata', severity: 'low', message: 'Some videos lack custom thumbnails — run the SEO scorecard per video.' });
    else strengths.push('Consistent custom thumbnails.');
  }

  const w = { engagement: 25, retention: 25, cadence: 20, growth: 15, metadata: 15 };
  const score = Math.round((engScore * w.engagement + retScore * w.retention + cadScore * w.cadence + growthScore * w.growth + metaScore * w.metadata) / 100);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  const SEV = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => (SEV[a.severity] ?? 9) - (SEV[b.severity] ?? 9));

  void options;
  return {
    score, grade, subscriberCount: subs,
    subscores: { engagement: engScore, retention: retScore, cadence: cadScore, growth: growthScore, metadata: metaScore },
    issues, strengths,
  };
}

/** Orchestrator: pull real channel metrics + top videos and audit them. */
async function getChannelAudit(userId, options = {}) {
  const yt = require('./youtubeAnalyticsService');
  let channel = null;
  let videos = [];
  try {
    channel = await yt.getChannelMetrics(userId, { days: options.days || 28 });
    const top = await yt.getTopVideos(userId, { days: options.days || 28, limit: 25 }).catch(() => []);
    videos = (Array.isArray(top) ? top : (top && top.videos) || []).map((v) => ({
      publishedAt: v.publishedAt || v.published || null,
      views: Number(v.views) || 0,
      durationSec: Number(v.durationSec || v.duration) || 0,
      hasThumbnail: v.hasThumbnail !== false,
    }));
  } catch (err) {
    logger.warn('[channelAudit] data fetch failed', { error: err.message });
    return { available: false, reason: 'no_channel_connected' };
  }
  if (!channel) return { available: false, reason: 'no_channel_connected' };

  const audit = auditChannel({
    subscriberCount: channel.subscriberCount,
    metrics: channel.metrics || channel,
    videos,
  });
  return { available: true, period: `${options.days || 28}d`, ...audit };
}

module.exports = { auditChannel, getChannelAudit };

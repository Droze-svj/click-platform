'use strict';

/**
 * One reading of a ScheduledPost's `analytics` sub-document.
 *
 * The numbers arrive in different shapes depending on who wrote them:
 *   - platform sync (platformAnalyticsService) — `impressions` + an
 *     `engagementBreakdown` without `views` for X/Twitter, top-level `views`
 *     for the video platforms;
 *   - manual results (/api/post-results) — top-level fields AND the breakdown;
 *   - older rows — only `engagementBreakdown`.
 * Each analytics surface used to pick its own fallback chain, and
 * /analytics/creator/stats showed the ENGAGEMENT count as "views" (and a 100%
 * engagement rate) for every post synced from X. Read them all here.
 */
function firstPositive(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function postMetrics(analytics) {
  const a = analytics || {};
  const b = a.engagementBreakdown || {};
  const views = firstPositive(a.views, b.views, a.videoViews, a.impressions);
  const likes = firstPositive(a.likes, b.likes, b.reactions);
  const comments = firstPositive(a.comments, b.comments, a.replies, b.replies);
  const shares = firstPositive(a.shares, b.shares, a.retweets, b.retweets);
  const saves = firstPositive(a.saves, b.saves);
  const interactions = likes + comments + shares;
  const engagementRate = views > 0 ? Math.round((interactions / views) * 10000) / 100 : 0;
  return { views, likes, comments, shares, saves, engagementRate };
}

module.exports = { postMetrics };

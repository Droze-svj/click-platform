// Unified Insights Accessor
// --------------------------
// A light READ layer that gives the marketing brain / recommendations a single
// normalized per-user insight summary, reconciling the field-name differences
// between the real underlying sources WITHOUT rewriting any model or running a
// migration (that's a future phase):
//
//   - ScheduledPost.analytics   ->  engagement, engagementRate (object), reach
//   - VideoMetrics              ->  views.total, retention.curve, completion.rate
//   - account insights          ->  followerCount, audience (SocialConnection cache)
//
// Honesty contract: when there is no real data we return an explicit
// `hasData: false` empty summary — never fabricated numbers.

const ScheduledPost = require('./../models/ScheduledPost');
const VideoMetrics = require('./../models/VideoMetrics');
const logger = require('../utils/logger');

/**
 * PURE normalizer. Given the three raw source shapes, produce one normalized
 * summary. No I/O — unit-testable with mocked inputs.
 *
 * @param {Object[]} posts    Array of ScheduledPost-like { analytics } docs.
 * @param {Object[]} videos   Array of VideoMetrics-like docs.
 * @param {Object[]} accounts Array of account-insight entries
 *                            ({ platform, followerCount, audience, available }).
 * @returns {Object} normalized summary
 */
function normalizeInsights(posts = [], videos = [], accounts = []) {
  const empty = {
    hasData: false,
    posts: { count: 0, totalViews: 0, totalEngagement: 0, avgEngagementRate: 0, avgRetention: null },
    audience: { totalFollowers: null, byPlatform: [] },
  };

  // ── Post performance (ScheduledPost.analytics) ──
  // Reconcile: views can be `analytics.views` or `analytics.videoViews`;
  // engagement is a flat number `analytics.engagement`; the engagement RATE is
  // an object `analytics.engagementRate.{byReach,byImpressions}` (NOT a scalar).
  let totalViews = 0;
  let totalEngagement = 0;
  let totalReach = 0;
  let postsCounted = 0;

  for (const p of posts) {
    const a = (p && p.analytics) || {};
    const views = a.views ?? a.videoViews ?? a.impressions ?? 0;
    const engagement = a.engagement ?? 0;
    const reach = a.reach ?? a.impressions ?? 0;
    if ((views || engagement || reach) > 0) {
      totalViews += views;
      totalEngagement += engagement;
      totalReach += reach;
      postsCounted += 1;
    }
  }
  const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;

  // ── Video retention (VideoMetrics) ──
  // Reconcile: views live under `views.total` (object), retention under
  // `retention.curve` / `retention.averageRetention`, completion under
  // `completion.rate`.
  let retentionSum = 0;
  let retentionCount = 0;
  for (const v of videos) {
    if (!v) continue;
    let avgRet = v.retention?.averageRetention;
    if (avgRet == null && Array.isArray(v.retention?.curve) && v.retention.curve.length) {
      avgRet = v.retention.curve.reduce((s, pt) => s + (pt.percentage || 0), 0) / v.retention.curve.length;
    }
    if (typeof avgRet === 'number' && avgRet > 0) {
      retentionSum += avgRet;
      retentionCount += 1;
    }
    // Note: video view totals are intentionally NOT folded in here — they're
    // already represented via ScheduledPost.analytics above, so adding
    // VideoMetrics.views.total would double-count the same posts.
  }
  const avgRetention = retentionCount > 0 ? retentionSum / retentionCount : null;

  // ── Audience (account insights) ──
  const audienceEntries = [];
  let totalFollowers = null;
  for (const acc of accounts) {
    if (!acc || acc.available === false || acc.followerCount == null) {
      // Keep an honest "unavailable" marker, but don't add to totals.
      audienceEntries.push({
        platform: acc?.platform,
        followerCount: null,
        available: false,
        audience: null,
      });
      continue;
    }
    totalFollowers = (totalFollowers || 0) + acc.followerCount;
    audienceEntries.push({
      platform: acc.platform,
      followerCount: acc.followerCount,
      available: true,
      audience: acc.audience || null,
    });
  }

  const hasData = postsCounted > 0 || retentionCount > 0 || totalFollowers != null;
  if (!hasData) return empty;

  return {
    hasData: true,
    posts: {
      count: postsCounted,
      totalViews,
      totalEngagement,
      avgEngagementRate: Number(avgEngagementRate.toFixed(2)),
      avgRetention: avgRetention != null ? Number(avgRetention.toFixed(2)) : null,
    },
    audience: {
      totalFollowers,
      byPlatform: audienceEntries,
    },
  };
}

/**
 * Build the unified insight summary for a user from the real existing sources.
 * Reads recent posts + their VideoMetrics + cached account insights.
 */
async function getUserInsightSummary(userId, { postLimit = 100 } = {}) {
  try {
    if (!userId) return normalizeInsights([], [], []);

    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      'analytics.lastUpdated': { $exists: true },
    })
      .sort({ postedAt: -1 })
      .limit(postLimit)
      .select('analytics platform _id')
      .lean();

    const postIds = posts.map(p => p._id);
    let videos = [];
    if (postIds.length) {
      videos = await VideoMetrics.find({ postId: { $in: postIds } })
        .select('views retention completion')
        .lean();
    }

    // Account insights cache (reuse the dedicated service so there's one source
    // of truth for follower/audience signals).
    let accounts = [];
    try {
      const { getAccountInsights } = require('./accountInsightsService');
      accounts = await getAccountInsights(userId);
    } catch (accErr) {
      logger.debug('insightsService: account insights unavailable', { error: accErr.message });
    }

    return normalizeInsights(posts, videos, accounts);
  } catch (error) {
    logger.warn('insightsService: getUserInsightSummary failed', { error: error.message });
    return normalizeInsights([], [], []);
  }
}

module.exports = {
  getUserInsightSummary,
  normalizeInsights,
};

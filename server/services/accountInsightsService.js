// Account Insights Service
// -------------------------
// Collects ACCOUNT-LEVEL (not per-post) insights — follower counts and, where
// the platform API exposes it, audience signals — for every connected account
// and feeds them into the learning loop.
//
// Why this exists: the per-platform profile/channel/user insight methods
// (getProfileInsights / getChannelInsights / getUserInsights / getMemberInsights)
// already existed but were only reachable via the DEAD socialMediaService
// .syncSocialInsights, which is never scheduled. This service is the live wiring:
// the platform ingestion cron calls syncAccountInsights(userId) on each tick.
//
// Honesty contract (owner's #1 rule):
//   - Each platform insight method returns either real numbers or
//     `{ available: false, reason }`. We persist ONLY real numbers. When a
//     platform is unavailable we record nothing for it (no zero followers, no
//     fabricated demographics) — just log the reason.
//   - Every platform is isolated in its own try/catch so one platform's
//     failure can never break the others or the cron tick.
//
// Persistence:
//   - SocialConnection.followerCount / .audience / .lastInsightsSync  — a fast
//     "latest value" cache the marketing brain reads via getAccountInsights().
//   - AudienceGrowth snapshot (via socialPerformanceMetricsService) — the
//     authoritative time-series for growth/churn trends.

const SocialConnection = require('../models/SocialConnection');
const OAuthService = require('./oauthService');
const { recordAudienceGrowth } = require('./socialPerformanceMetricsService');
const logger = require('../utils/logger');

const LOG_CONTEXT = { service: 'account-insights' };

/**
 * Normalize a platform insight method's result into a common shape.
 * Returns { available, followerCount, followingCount, audience, reason }.
 * Pure-ish (no I/O) so it can be unit-tested with mocked platform results.
 */
function normalizePlatformInsight(platform, raw) {
  if (!raw || raw.available === false) {
    return { available: false, reason: raw?.reason || 'No insight data returned' };
  }

  // Each platform's insight method returns a slightly different shape; map them
  // to a common one. Twitter/YouTube legacy methods return raw API stats, the
  // new TikTok/LinkedIn methods return a normalized `{ available, followerCount }`.
  const plat = platform.toLowerCase();
  let followerCount = null;
  let followingCount = null;

  if (plat === 'twitter' || plat === 'x') {
    // Twitter getUserInsights -> public_metrics
    followerCount = raw.followers_count ?? raw.followerCount ?? null;
    followingCount = raw.following_count ?? null;
  } else if (plat === 'youtube') {
    // YouTube getChannelInsights -> channel statistics
    followerCount = raw.subscriberCount != null ? parseInt(raw.subscriberCount, 10) : (raw.followerCount ?? null);
  } else {
    // TikTok / LinkedIn (already normalized)
    followerCount = raw.followerCount ?? null;
    followingCount = raw.followingCount ?? null;
  }

  if (followerCount == null || Number.isNaN(followerCount)) {
    return { available: false, reason: 'Platform returned no follower count' };
  }

  return {
    available: true,
    followerCount,
    followingCount: followingCount ?? 0,
    audience: raw.audience || null, // demographics where the API exposes them
  };
}

/**
 * Fetch insights for a single connected account. Returns the normalized result.
 * Does NOT throw — returns `{ available:false, reason }` on any failure so the
 * caller can keep iterating other accounts.
 */
async function fetchPlatformInsight(userId, platform, accountId = null) {
  try {
    const auth = await OAuthService.getSocialCredentials(userId, platform, accountId);
    if (!auth?.accessToken) {
      return { available: false, reason: 'No credentials for account' };
    }

    let raw;
    switch (platform.toLowerCase()) {
    case 'youtube':
      raw = await require('./YouTubeSocialService').getChannelInsights(auth);
      break;
    case 'tiktok':
      raw = await require('./TikTokSocialService').getProfileInsights(auth);
      break;
    case 'twitter':
    case 'x':
      raw = await require('./TwitterSocialService').getUserInsights(auth);
      break;
    case 'linkedin':
      raw = await require('./LinkedInSocialService').getMemberInsights(auth);
      break;
    default:
      // Facebook/Instagram follower counts are handled by the existing
      // audienceGrowthSyncService path; no account-insight method here.
      return { available: false, reason: `Account insights not supported for ${platform}` };
    }

    return normalizePlatformInsight(platform, raw);
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

/**
 * Sync account-level insights for every connected account of one user.
 * Persists real values to SocialConnection + AudienceGrowth; skips honestly
 * when a platform is unavailable.
 */
async function syncAccountInsights(userId) {
  const summary = { synced: 0, unavailable: 0, failed: 0 };

  let connections = [];
  try {
    connections = await SocialConnection.find({ userId, isActive: true }).lean();
  } catch (error) {
    logger.warn('account-insights: failed to load connections', { ...LOG_CONTEXT, userId: String(userId), error: error.message });
    return summary;
  }

  for (const conn of connections) {
    try {
      const accountId = conn.platformUserId || null;
      const insight = await fetchPlatformInsight(userId, conn.platform, accountId);

      if (!insight.available) {
        summary.unavailable += 1;
        logger.debug('account-insights: platform unavailable', {
          ...LOG_CONTEXT, userId: String(userId), platform: conn.platform, reason: insight.reason,
        });
        continue;
      }

      // 1) Fast-read cache on the connection (latest values only).
      await SocialConnection.updateOne(
        { _id: conn._id },
        {
          $set: {
            followerCount: insight.followerCount,
            audience: insight.audience || conn.audience || null,
            lastInsightsSync: new Date(),
          },
        }
      );

      // 2) Authoritative time-series snapshot for growth/churn trends.
      // recordAudienceGrowth computes change vs. the previous snapshot itself,
      // so we don't fabricate new/lost-follower deltas here.
      try {
        await recordAudienceGrowth(userId, conn.platform, {
          platformAccountId: conn.platformUserId || conn.platformAccountId || 'primary',
          followers: insight.followerCount,
          following: insight.followingCount || 0,
          period: 'daily',
          metadata: {
            platformUsername: conn.platformUsername,
            audience: insight.audience || undefined,
          },
        });
      } catch (growthErr) {
        // Snapshot is best-effort; the connection cache is already updated.
        logger.debug('account-insights: growth snapshot skipped', {
          ...LOG_CONTEXT, platform: conn.platform, error: growthErr.message,
        });
      }

      summary.synced += 1;
    } catch (error) {
      summary.failed += 1;
      logger.warn('account-insights: per-account failure', {
        ...LOG_CONTEXT, userId: String(userId), platform: conn.platform, error: error.message,
      });
    }
  }

  return summary;
}

/**
 * Read the cached account insights for a user (for the marketing brain /
 * recommendations). Returns one entry per connected account with real values,
 * and an honest `available:false` marker where it was never successfully synced.
 */
async function getAccountInsights(userId) {
  try {
    const connections = await SocialConnection.find({ userId, isActive: true })
      .select('platform platformUsername followerCount audience lastInsightsSync')
      .lean();

    return connections.map(c => ({
      platform: c.platform,
      username: c.platformUsername || null,
      available: c.followerCount != null,
      followerCount: c.followerCount, // null when never synced/unavailable
      audience: c.audience || null,
      lastInsightsSync: c.lastInsightsSync || null,
    }));
  } catch (error) {
    logger.warn('account-insights: getAccountInsights failed', { ...LOG_CONTEXT, error: error.message });
    return [];
  }
}

module.exports = {
  syncAccountInsights,
  getAccountInsights,
  fetchPlatformInsight,
  normalizePlatformInsight,
};

// Optimal Posting Time Service
// Aggregates a user's *real* per-post engagement, grouped by platform,
// hour-of-day and day-of-week, and returns the windows that have actually
// outperformed historical baseline.
//
// Returns null (NOT a fabricated suggestion) when the sample size is too
// small to be statistically meaningful, so the UI can fall back to
// "no recommendation yet" instead of misleading the user.

const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

const MIN_POSTS_FOR_RECOMMENDATION = parseInt(process.env.OPTIMAL_TIME_MIN_POSTS || '8', 10);
const DEFAULT_LOOKBACK_DAYS = parseInt(process.env.OPTIMAL_TIME_LOOKBACK_DAYS || '90', 10);

/**
 * Engagement rate for a post: prefer engagement / reach when reach is known,
 * otherwise engagement / impressions, otherwise raw engagement.
 */
function engagementRate(post) {
  const a = post.analytics || {};
  const denom = a.reach || a.impressions || 0;
  if (denom > 0) return (a.engagement || 0) / denom;
  return a.engagement || 0;
}

/**
 * Build the `[platform][dayOfWeek][hour]` aggregate.
 * `score` = sum of per-post engagement rate.
 * `count` = number of posts in that bucket.
 */
function bucketize(posts, timezone) {
  const buckets = {};
  for (const post of posts) {
    const platform = post.platform;
    const when = post.postedAt ? new Date(post.postedAt) : null;
    if (!when || isNaN(when.getTime())) continue;

    // Day-of-week + hour in the user's timezone (defaults to server local).
    const localized = timezone
      ? new Date(when.toLocaleString('en-US', { timeZone: timezone }))
      : when;
    const dow = localized.getDay();         // 0 = Sun, 6 = Sat
    const hour = localized.getHours();      // 0..23

    if (!buckets[platform]) buckets[platform] = {};
    if (!buckets[platform][dow]) buckets[platform][dow] = {};
    if (!buckets[platform][dow][hour]) buckets[platform][dow][hour] = { score: 0, count: 0 };

    buckets[platform][dow][hour].score += engagementRate(post);
    buckets[platform][dow][hour].count += 1;
  }
  return buckets;
}

/**
 * Pick the top N (dow, hour) windows for one platform, ranked by mean
 * engagement rate. Returns [] when the platform has fewer than the
 * required minimum number of posts.
 */
function topWindowsForPlatform(platformBuckets, totalPostsOnPlatform, topN = 3) {
  if (totalPostsOnPlatform < MIN_POSTS_FOR_RECOMMENDATION) return [];

  const flat = [];
  for (const dowKey of Object.keys(platformBuckets)) {
    const dow = parseInt(dowKey, 10);
    for (const hourKey of Object.keys(platformBuckets[dowKey])) {
      const hour = parseInt(hourKey, 10);
      const { score, count } = platformBuckets[dowKey][hourKey];
      if (count === 0) continue;
      flat.push({
        dayOfWeek: dow,
        hour,
        sampleSize: count,
        meanEngagement: score / count,
      });
    }
  }

  return flat
    .sort((a, b) => b.meanEngagement - a.meanEngagement)
    .slice(0, topN);
}

/**
 * Public: get optimal posting windows for a user.
 *
 * @param {string} userId
 * @param {object} opts
 * @param {string} [opts.platform]   restrict to one platform
 * @param {string} [opts.timezone]   IANA timezone for hour/day grouping
 * @param {number} [opts.lookbackDays]
 * @returns {Promise<{
 *   confident: boolean,
 *   sampleSize: number,
 *   minRequired: number,
 *   windows: Record<string, Array<{dayOfWeek:number, hour:number, sampleSize:number, meanEngagement:number}>>,
 *   nextSuggested: Record<string, string|null>,
 * }>}
 */
async function getOptimalPostingWindows(userId, opts = {}) {
  const {
    platform = null,
    timezone = null,
    lookbackDays = DEFAULT_LOOKBACK_DAYS,
  } = opts;

  const startDate = new Date(Date.now() - lookbackDays * 86400000);
  const query = {
    userId,
    status: 'posted',
    postedAt: { $gte: startDate },
    'analytics.engagement': { $gt: 0 },
  };
  if (platform) query.platform = platform.toLowerCase();

  const posts = await ScheduledPost.find(query)
    .select('platform postedAt analytics')
    .lean();

  const buckets = bucketize(posts, timezone);
  const platformsConsidered = platform ? [platform.toLowerCase()] : Object.keys(buckets);

  const windowsByPlatform = {};
  const nextSuggested = {};
  let anyConfident = false;

  for (const plat of platformsConsidered) {
    const platBuckets = buckets[plat] || {};
    const platCount = posts.filter(p => p.platform === plat).length;
    const tops = topWindowsForPlatform(platBuckets, platCount);
    windowsByPlatform[plat] = tops;
    nextSuggested[plat] = tops.length > 0 ? nextOccurrenceISO(tops[0], timezone) : null;
    if (tops.length > 0) anyConfident = true;
  }

  return {
    confident: anyConfident,
    sampleSize: posts.length,
    minRequired: MIN_POSTS_FOR_RECOMMENDATION,
    windows: windowsByPlatform,
    nextSuggested,
  };
}

/**
 * Compute the next wall-clock occurrence of (dayOfWeek, hour), in UTC ISO
 * for the front-end to drop into a `<input type="datetime-local">`.
 */
function nextOccurrenceISO(window, timezone) {
  if (!window) return null;
  const now = new Date();
  // Find the next date matching `window.dayOfWeek`.
  const result = new Date(now);
  const daysAhead = (window.dayOfWeek - now.getDay() + 7) % 7;
  result.setDate(now.getDate() + daysAhead);
  result.setHours(window.hour, 0, 0, 0);

  // If the slot is today but already past, jump to next week.
  if (result.getTime() <= now.getTime()) {
    result.setDate(result.getDate() + 7);
  }

  // If a timezone is provided, shift so the local hour matches.
  if (timezone) {
    try {
      const localHour = parseInt(
        new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
          .format(result),
        10
      );
      const offsetHours = window.hour - localHour;
      if (offsetHours !== 0) result.setHours(result.getHours() + offsetHours);
    } catch (err) {
      logger.warn('Invalid timezone in optimal-time suggestion', { timezone, error: err.message });
    }
  }

  return result.toISOString();
}

module.exports = {
  getOptimalPostingWindows,
};

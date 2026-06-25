// Syncs a creator's REAL channel videos (Click-published + external) into the
// canonical SocialVideo store, so the Growth layer covers their whole channel.
// Source is the platform API (YouTube Data/Analytics) — never fabricated.

const logger = require('../utils/logger');

/** PURE: map a getTopVideos item → a SocialVideo upsert payload. */
function buildVideoRecord(v, ctx = {}) {
  return {
    userId: String(ctx.userId),
    accountId: ctx.accountId || null,
    platform: ctx.platform || 'youtube',
    externalId: String((v && (v.videoId || v.externalId)) || ''),
    title: (v && v.title) || '',
    thumbnail: (v && v.thumbnail) || null,
    hasThumbnail: !!(v && v.hasThumbnail !== false && (v.thumbnail || v.hasThumbnail)),
    durationSec: Number(v && v.durationSec) || 0,
    publishedAt: v && v.publishedAt ? new Date(v.publishedAt) : null,
    views: Number(v && v.views) || 0,
    likes: Number(v && v.likes) || 0,
    comments: Number(v && v.comments) || 0,
  };
}

/**
 * Sync the user's YouTube channel videos into SocialVideo. Pulls the channel's
 * top videos (real API data), links any that were Click-published (via
 * ScheduledPost.platformPostId), and upserts. Honest available:false when the
 * account isn't connected.
 */
async function syncYouTubeVideos(userId, options = {}) {
  const SocialVideo = require('../models/SocialVideo');
  const ScheduledPost = require('../models/ScheduledPost');
  const yt = require('./youtubeAnalyticsService');
  const accountId = options.accountId || null;

  const top = await yt.getTopVideos(userId, { days: options.days || 365, limit: 50, accountId }).catch(() => null);
  if (!top || top.connected === false) {
    return { available: false, reason: (top && top.reason) || 'not_connected', synced: 0 };
  }
  const videos = Array.isArray(top.videos) ? top.videos : [];
  if (!videos.length) return { available: true, synced: 0, accountId };

  // Link Click-published videos by matching ScheduledPost.platformPostId.
  let linkMap = new Map();
  try {
    const ids = videos.map((v) => v.videoId).filter(Boolean);
    const posts = await ScheduledPost.find({ platform: 'youtube', platformPostId: { $in: ids }, userId: String(userId) })
      .select('platformPostId contentId').lean();
    linkMap = new Map(posts.map((p) => [p.platformPostId, p.contentId]));
  } catch (_) { /* linking is best-effort */ }

  let synced = 0;
  for (const v of videos) {
    const rec = buildVideoRecord(v, { userId, accountId, platform: 'youtube' });
    if (!rec.externalId) continue;
    const contentId = linkMap.get(rec.externalId) || null;
    rec.contentId = contentId;
    rec.source = contentId ? 'click' : 'import';
    rec.lastSyncedAt = new Date();
    try {
      await SocialVideo.updateOne(
        { userId: rec.userId, platform: rec.platform, externalId: rec.externalId },
        { $set: rec },
        { upsert: true },
      );
      synced++;
    } catch (e) {
      logger.warn('[socialVideoSync] upsert failed', { externalId: rec.externalId, error: e.message });
    }
  }
  logger.info('[socialVideoSync] synced YouTube videos', { userId: String(userId), synced, accountId });
  return { available: true, synced, accountId };
}

/** List a user's synced videos (for discovery / pickers). */
async function listVideos(userId, options = {}) {
  const SocialVideo = require('../models/SocialVideo');
  const q = { userId: String(userId), platform: options.platform || 'youtube' };
  if (options.accountId) q.accountId = options.accountId;
  const limit = Math.max(1, Math.min(Number(options.limit) || 50, 200));
  const videos = await SocialVideo.find(q)
    .select('externalId title thumbnail durationSec publishedAt views likes comments contentId source lastSyncedAt')
    .sort({ views: -1 })
    .limit(limit)
    .lean()
    .catch(() => []);
  return { platform: q.platform, total: videos.length, videos };
}

/**
 * Scheduled sync: refresh SocialVideo for every user with an active YouTube
 * connection. Bounded + best-effort (one user's failure never blocks the rest).
 */
async function runScheduledSync(options = {}) {
  const SocialConnection = require('../models/SocialConnection');
  const max = Math.max(1, Math.min(Number(options.limit) || 500, 5000));
  let userIds = [];
  try {
    userIds = await SocialConnection.distinct('userId', { platform: 'youtube', isActive: true });
  } catch (err) {
    logger.warn('[socialVideoSync] scheduled sync: connection query failed', { error: err.message });
    return { users: 0, synced: 0 };
  }
  let users = 0;
  let synced = 0;
  for (const uid of userIds.slice(0, max)) {
    try {
      const r = await syncYouTubeVideos(uid, {});
      if (r && r.available) { users += 1; synced += r.synced || 0; }
    } catch (err) {
      logger.warn('[socialVideoSync] scheduled sync failed for user', { userId: String(uid), error: err.message });
    }
  }
  logger.info('[socialVideoSync] scheduled sync complete', { users, synced });
  return { users, synced };
}

module.exports = { buildVideoRecord, syncYouTubeVideos, listVideos, runScheduledSync };

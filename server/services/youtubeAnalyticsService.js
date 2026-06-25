// YouTube Analytics + Data API client.
//
// Wave C of the public-readiness pass surfaces real channel-level
// insights so the prompt builder's `getTopPerformingPlaybook` can fold
// in long-form performance (not just the ScheduledPost-driven short-
// form analytics). This service reads — it doesn't write. Uploads
// continue to live in YouTubeSocialService.
//
// Auth path: the Google OAuth flow stores tokens via OAuthService /
// OAuthStorage (multi-account aware after the prior pass). Each method
// resolves credentials with the caller-supplied accountId, falling
// through to the user's active Google account when none is given.

const { google } = require('googleapis');
const logger = require('../utils/logger');
const OAuthService = require('./oauthService');

const LOG_CONTEXT = { service: 'youtube-analytics' };

/** Parse a YouTube ISO-8601 duration ("PT1M30S") to seconds. 0 on absent/garbage. */
function parseIso8601Duration(iso) {
  if (typeof iso !== 'string') return 0;
  const m = iso.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x) || 0);
  return d * 86400 + h * 3600 + min * 60 + s;
}

/**
 * Build an OAuth2 client preloaded with the user's stored credentials.
 * Returns null when Google is not connected for this user — every caller
 * checks for null and surfaces `{ connected: false }` so routes can
 * answer 200-with-empty rather than 500.
 */
async function buildOAuthClient(userId, accountId = null) {
  // Resolve credentials via the Google service helpers — they fall back
  // to YOUTUBE_CLIENT_ID/SECRET when GOOGLE_* are unset, since the same
  // Google Cloud project owns YouTube + Search Console + basic profile.
  // Without that fallback this service was dark for every install that
  // had wired YouTube credentials but no separate "google" pair.
  const { getGoogleClientId, getGoogleClientSecret, getGoogleCallbackUrl } = require('./googleOAuthService');
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    return null; // Treat as "not connected" — routes return `{ connected: false }`.
  }
  const creds = await OAuthService.getSocialCredentials(userId, 'google', accountId).catch(() => null);
  if (!creds || !creds.accessToken) return null;
  const client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    getGoogleCallbackUrl() || undefined
  );
  client.setCredentials({
    access_token: creds.accessToken,
    refresh_token: creds.refreshToken || undefined,
    expiry_date: creds.expiresAt ? new Date(creds.expiresAt).getTime() : undefined,
  });
  return client;
}

/**
 * Top-level channel metrics for the connected user. Defaults to the last
 * 28 days of activity. Returns:
 *   { connected: true, channelId, channelTitle,
 *     metrics: { views, watchTimeMinutes, subscribersGained,
 *                averageViewDuration, likes, comments, shares } }
 * Or `{ connected: false }` if Google isn't linked / configured.
 */
async function getChannelMetrics(userId, { days = 28, accountId = null } = {}) {
  const auth = await buildOAuthClient(userId, accountId);
  if (!auth) return { connected: false, reason: 'google_not_connected' };

  try {
    const youtube = google.youtube({ version: 'v3', auth });
    const ytChannels = await youtube.channels.list({ part: ['id', 'snippet', 'statistics'], mine: true });
    const channel = ytChannels.data?.items?.[0];
    if (!channel) return { connected: true, channelId: null, metrics: null, reason: 'no_channel' };

    // YouTube Analytics API — v2 reads aggregated metrics.
    const analytics = google.youtubeAnalytics({ version: 'v2', auth });
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const report = await analytics.reports.query({
      ids: `channel==${channel.id}`,
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,subscribersGained,averageViewDuration,likes,comments,shares',
    });

    const row = report.data?.rows?.[0] || [];
    return {
      connected: true,
      channelId: channel.id,
      channelTitle: channel.snippet?.title || null,
      thumbnail: channel.snippet?.thumbnails?.default?.url || null,
      subscriberCount: Number(channel.statistics?.subscriberCount || 0),
      videoCount: Number(channel.statistics?.videoCount || 0),
      window: { startDate, endDate, days },
      metrics: {
        views: Number(row[0] || 0),
        watchTimeMinutes: Number(row[1] || 0),
        subscribersGained: Number(row[2] || 0),
        averageViewDuration: Number(row[3] || 0),
        likes: Number(row[4] || 0),
        comments: Number(row[5] || 0),
        shares: Number(row[6] || 0),
      },
    };
  } catch (err) {
    logger.error('YouTube channel metrics fetch failed', { ...LOG_CONTEXT, userId, error: err.message });
    return { connected: true, error: err.message, metrics: null };
  }
}

/**
 * Top videos by views in the same window. Used to fold the creator's
 * winning long-form into the playbook bias for clips. Returns
 * `{ connected: true, videos: [{ videoId, title, views, watchTimeMinutes, avgViewDuration, publishedAt, thumbnail }] }`.
 */
async function getTopVideos(userId, { days = 28, limit = 10, accountId = null } = {}) {
  const auth = await buildOAuthClient(userId, accountId);
  if (!auth) return { connected: false, reason: 'google_not_connected', videos: [] };

  try {
    const youtube = google.youtube({ version: 'v3', auth });
    const channels = await youtube.channels.list({ part: ['id'], mine: true });
    const channelId = channels.data?.items?.[0]?.id;
    if (!channelId) return { connected: true, videos: [], reason: 'no_channel' };

    const analytics = google.youtubeAnalytics({ version: 'v2', auth });
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const report = await analytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,likes',
      dimensions: 'video',
      sort: '-views',
      maxResults: Math.max(1, Math.min(50, limit)),
    });

    const rows = report.data?.rows || [];
    if (rows.length === 0) return { connected: true, videos: [], window: { startDate, endDate, days } };

    const videoIds = rows.map((r) => r[0]).filter(Boolean);
    const videosResp = await youtube.videos.list({ part: ['snippet', 'contentDetails'], id: videoIds });
    const meta = new Map((videosResp.data?.items || []).map((v) => [v.id, v]));

    const videos = rows.map((r) => {
      const v = meta.get(r[0]);
      const thumbnail = v?.snippet?.thumbnails?.medium?.url || null;
      return {
        videoId: r[0],
        title: v?.snippet?.title || null,
        thumbnail,
        hasThumbnail: !!(v?.snippet?.thumbnails?.maxres || v?.snippet?.thumbnails?.high || thumbnail),
        publishedAt: v?.snippet?.publishedAt || null,
        durationSec: parseIso8601Duration(v?.contentDetails?.duration),
        views: Number(r[1] || 0),
        watchTimeMinutes: Number(r[2] || 0),
        averageViewDuration: Number(r[3] || 0),
        likes: Number(r[4] || 0),
      };
    });

    return { connected: true, window: { startDate, endDate, days }, videos };
  } catch (err) {
    logger.error('YouTube top-videos fetch failed', { ...LOG_CONTEXT, userId, error: err.message });
    return { connected: true, error: err.message, videos: [] };
  }
}

/**
 * Audience retention curve for a single video. Returns an array of
 * `{ elapsedRatio, audienceWatchRatio }` points the editor can render
 * as a sparkline ("most viewers drop at 0:18").
 */
async function getVideoRetention(userId, videoId, { accountId = null } = {}) {
  const auth = await buildOAuthClient(userId, accountId);
  if (!auth) return { connected: false, reason: 'google_not_connected', curve: [] };
  if (!videoId) return { connected: true, curve: [], reason: 'videoId_required' };

  try {
    const analytics = google.youtubeAnalytics({ version: 'v2', auth });
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const report = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'audienceWatchRatio,relativeRetentionPerformance',
      dimensions: 'elapsedVideoTimeRatio',
      filters: `video==${videoId}`,
    });
    const curve = (report.data?.rows || []).map((r) => ({
      elapsedRatio: Number(r[0] || 0),
      audienceWatchRatio: Number(r[1] || 0),
      relativeRetentionPerformance: Number(r[2] || 0),
    }));
    return { connected: true, videoId, curve };
  } catch (err) {
    logger.error('YouTube retention fetch failed', { ...LOG_CONTEXT, userId, videoId, error: err.message });
    return { connected: true, error: err.message, curve: [] };
  }
}

/**
 * PURE: map YouTube's retention curve [{ elapsedRatio, audienceWatchRatio }]
 * (ratios 0–1) into the analyzer's [{ second, percentage }] shape using the
 * video's duration. Empty when duration is unknown (can't place a ratio in time).
 */
function mapRetentionCurve(ytCurve, durationSec) {
  const d = Number(durationSec) || 0;
  if (!d || !Array.isArray(ytCurve)) return [];
  return ytCurve
    .map((p) => ({
      second: Math.round((Number(p && p.elapsedRatio) || 0) * d),
      percentage: Math.round((Number(p && p.audienceWatchRatio) || 0) * 100),
    }))
    .filter((p) => Number.isFinite(p.second) && Number.isFinite(p.percentage))
    .sort((a, b) => a.second - b.second);
}

/**
 * Live YouTube retention, mapped to the analyzer's { second, percentage } shape.
 * Fetches the video duration (contentDetails) to place ratios in time, then the
 * retention curve. Honest connected:false / empty curve when unavailable.
 */
async function getMappedVideoRetention(userId, videoId, { accountId = null } = {}) {
  const auth = await buildOAuthClient(userId, accountId);
  if (!auth) return { connected: false, reason: 'google_not_connected', curve: [], durationSec: 0 };
  if (!videoId) return { connected: true, curve: [], durationSec: 0, reason: 'videoId_required' };
  try {
    const youtube = google.youtube({ version: 'v3', auth });
    const vresp = await youtube.videos.list({ part: ['contentDetails'], id: [videoId] });
    const durationSec = parseIso8601Duration(vresp.data?.items?.[0]?.contentDetails?.duration);
    const ret = await getVideoRetention(userId, videoId, { accountId });
    const curve = mapRetentionCurve(ret.curve, durationSec);
    return { connected: true, videoId, durationSec, curve };
  } catch (err) {
    logger.error('YouTube mapped-retention fetch failed', { ...LOG_CONTEXT, userId, videoId, error: err.message });
    return { connected: true, error: err.message, curve: [], durationSec: 0 };
  }
}

module.exports = {
  getChannelMetrics,
  getTopVideos,
  getVideoRetention,
  getMappedVideoRetention,
  mapRetentionCurve,
  parseIso8601Duration,
};

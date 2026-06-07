/**
 * TikTok Social Media Service
 * Handles posting videos to TikTok via the Content Posting API
 */

const axios = require('axios');
const logger = require('../utils/logger');

// Surfaced to the cron + drawer so the UI can render a clear "coming
// soon" badge instead of a fake-success URL the user might click on.
const TIKTOK_NOT_AVAILABLE = 'TikTok publishing is not yet available. Click currently supports direct posting on Twitter, LinkedIn, Facebook, Instagram, and YouTube. Reels can still be cross-posted to Instagram and Shorts to YouTube.';

/**
 * Post a video to TikTok.
 *
 * Implementation note: a real TikTok publish requires the v2
 * Content-Posting init → upload-binary → publish dance, which depends
 * on TikTok app review (Content Posting API scope is not granted by
 * default to sandbox apps). Until the app is approved we surface a
 * typed error so:
 *   1. The scheduler cron tags the post as `failed` (not fake-success).
 *   2. The clip-publish drawer can guard the TikTok tab in advance.
 *   3. Logs show the real reason so it's not mistaken for a token issue.
 */
async function postToTikTok(authData, contentData) {
  const { title, mediaUrl } = contentData || {};
  logger.warn('TikTok publish requested but not yet available', {
    title, mediaUrl, hasToken: !!authData?.accessToken,
  });
  const err = new Error(TIKTOK_NOT_AVAILABLE);
  err.code = 'TIKTOK_NOT_AVAILABLE';
  err.platform = 'tiktok';
  err.status = 'pending_approval';
  err.userMessage = 'TikTok publishing is coming soon — connect your account now to be ready the moment it launches.';
  throw err;
}

/**
 * Returns the structured coming-soon status for use in UI badge rendering.
 * Callers can check this without triggering the actual post attempt.
 */
function getTikTokStatus() {
  return {
    available: false,
    status: 'pending_approval',
    userMessage: 'TikTok publishing is pending app review. Connect your account now so you\'re ready to post the moment it launches.',
    eta: null,
  };
}

/**
 * Fetch account-level profile insights (follower count, profile stats).
 *
 * Uses the real TikTok Display API `user/info` endpoint. This requires the
 * `user.info.stats` (and `user.info.profile`) scopes, which TikTok only grants
 * after app review — sandbox/unapproved apps get a scope error here.
 *
 * Honesty contract: on ANY failure (missing token, missing scope, network)
 * we return `{ available: false, reason }` with NO fabricated numbers, so the
 * insights sync records "TikTok data unavailable" rather than fake followers.
 * On success we return the real, normalized stats.
 */
async function getProfileInsights(authData) {
  const accessToken = authData?.accessToken;
  if (!accessToken || accessToken === 'dev-token') {
    return { available: false, platform: 'tiktok', reason: 'No TikTok access token available' };
  }

  try {
    const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: {
        fields: 'follower_count,following_count,likes_count,video_count',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const user = response.data?.data?.user || {};
    // Guard: if the API responded but returned no usable stats, stay honest.
    if (user.follower_count == null) {
      return {
        available: false,
        platform: 'tiktok',
        reason: 'TikTok returned no profile stats (likely missing user.info.stats scope)',
      };
    }

    return {
      available: true,
      platform: 'tiktok',
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      likesCount: user.likes_count || 0,
      videoCount: user.video_count || 0,
      // TikTok's Display API does not expose audience demographics; omit
      // rather than invent.
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    const reason = error.response?.data?.error?.message || error.message;
    logger.warn('[TikTok] getProfileInsights unavailable', { reason });
    return { available: false, platform: 'tiktok', reason };
  }
}

module.exports = {
  postToTikTok,
  getTikTokStatus,
  getProfileInsights,
};

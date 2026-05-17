/**
 * TikTok Social Media Service
 * Handles posting videos to TikTok via the Content Posting API
 */

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

module.exports = {
  postToTikTok,
  getTikTokStatus,
};

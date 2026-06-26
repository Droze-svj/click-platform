const { TwitterApi } = require('twitter-api-v2');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const downloadUtils = require('../utils/downloadUtils');

const MIME_BY_EXT = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp',
};
const mimeForPath = (p) => MIME_BY_EXT[path.extname(String(p || '')).toLowerCase()] || 'video/mp4';

class TwitterSocialService {
  /**
   * Resolve a mediaUrl to a LOCAL file path (+ mimeType + cleanup). Our own
   * "/uploads/..." reads straight off disk (path-traversal guarded); a remote
   * http(s) URL is downloaded via the SSRF-hardened streamDownload (re-guards
   * every redirect hop, size-capped). Returns null when there's no media.
   */
  static async _resolveMediaToFile(mediaUrl) {
    if (!mediaUrl) return null;
    if (String(mediaUrl).startsWith('/')) {
      const projectRoot = path.join(__dirname, '..', '..');
      const uploadsRoot = path.join(projectRoot, 'uploads');
      const localFile = path.resolve(projectRoot, '.' + mediaUrl);
      if (localFile.startsWith(uploadsRoot + path.sep) && fs.existsSync(localFile)) {
        return { filePath: localFile, mimeType: mimeForPath(localFile), cleanup: () => {} };
      }
      throw new Error(`media file not found for ${mediaUrl}`);
    }
    if (/^https?:\/\//i.test(mediaUrl)) {
      const tmpDir = path.join(__dirname, '..', '..', 'uploads', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `tw-media-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp4`);
      await downloadUtils.streamDownload(mediaUrl, tmpPath);
      return {
        filePath: tmpPath,
        mimeType: mimeForPath(mediaUrl),
        cleanup: () => { try { fs.unlinkSync(tmpPath); } catch (_) { /* best effort */ } },
      };
    }
    return null;
  }

  /**
   * Posts a tweet with optional media (image/video actually attached).
   */
  static async postTweet(auth, contentData) {
    const { title, description, mediaUrl, tags = [] } = contentData;
    logger.info(`[Twitter] Preparing tweet: ${title}`);

    // Initialize Twitter Client with OAuth 1.0a user tokens (v1 media upload
    // requires the accessSecret).
    const client = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: auth.accessToken,
      accessSecret: auth.accessSecret,
    });

    const tweetText = `${title}\n\n${description}\n\n${tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ')}`;

    // Resolve media up front so a media failure is surfaced honestly rather than
    // silently posting text-only (the previous behaviour "mocked" the upload).
    let media = null;
    try {
      media = await TwitterSocialService._resolveMediaToFile(mediaUrl);
    } catch (e) {
      logger.error('[Twitter] media resolve failed', { mediaUrl, error: e.message });
      throw new Error(`Twitter media could not be attached: ${e.message}`);
    }

    try {
      let mediaId;
      if (media) {
        mediaId = await client.v1.uploadMedia(media.filePath, { mimeType: media.mimeType });
      }
      const payload = mediaId ? { media: { media_ids: [mediaId] } } : undefined;
      const tweet = await client.v2.tweet(tweetText, payload);

      logger.info(`[Twitter] Tweet posted successfully: ${tweet.data.id}`, { withMedia: !!mediaId });
      return {
        id: tweet.data.id,
        url: `https://twitter.com/i/web/status/${tweet.data.id}`,
      };
    } catch (error) {
      logger.error('[Twitter] Tweet failed', { error: error.message });
      throw error;
    } finally {
      if (media) media.cleanup();
    }
  }

  /**
   * Gets user insights/metrics
   */
  static async getUserInsights(auth) {
    const client = new TwitterApi(auth.accessToken);
    try {
      const me = await client.v2.me({ 'user.fields': ['public_metrics'] });
      return me.data.public_metrics;
    } catch (error) {
      logger.error('[Twitter] Insights fetch failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a tweet
   */
  static async deleteTweet(auth, tweetId) {
    const client = new TwitterApi(auth.accessToken);
    try {
      await client.v2.deleteTweet(tweetId);
      return { success: true };
    } catch (error) {
      logger.error('[Twitter] Deletion failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = TwitterSocialService;

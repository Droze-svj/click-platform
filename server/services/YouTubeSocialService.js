const { google } = require('googleapis');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const downloadUtils = require('../utils/downloadUtils');

class YouTubeSocialService {
  /**
   * Resolve the upload body to a readable stream. Accepts either:
   *   - mediaPath: absolute or project-relative file path (fast path)
   *   - mediaUrl:  http(s) URL or "/uploads/..." path served by our app
   *
   * Historically this service only accepted mediaPath, but
   * socialMediaService.dispatchWithRecovery only forwards mediaUrl from
   * the scheduler/clip-publish flows. Without a mediaUrl fallback every
   * scheduled YouTube post died with ENOENT.
   *
   * Returns { stream, cleanup } where cleanup() removes any temp file
   * we downloaded (caller MUST call it after the upload completes).
   */
  static async _resolveUploadBody(contentData) {
    const { mediaPath, mediaUrl } = contentData;

    // Fast path: caller already gave us a real on-disk file.
    if (mediaPath && fs.existsSync(mediaPath)) {
      return { stream: fs.createReadStream(mediaPath), cleanup: () => {} };
    }

    if (mediaUrl) {
      // Our OWN media (an "/uploads/..." URL) lives on local disk — read it
      // directly. This removes an HTTP round-trip AND the SSRF risk of fetching
      // a "/"-path through PUBLIC_BASE_URL (which is localhost in dev, and could
      // be coerced toward internal services). A path-traversal guard keeps the
      // resolved file inside uploads/.
      if (mediaUrl.startsWith('/')) {
        const projectRoot = path.join(__dirname, '..', '..');
        const uploadsRoot = path.join(projectRoot, 'uploads');
        const localFile = path.resolve(projectRoot, '.' + mediaUrl); // "/uploads/x.mp4" → <root>/uploads/x.mp4
        if (localFile.startsWith(uploadsRoot + path.sep) && fs.existsSync(localFile)) {
          return { stream: fs.createReadStream(localFile), cleanup: () => {} };
        }
        throw new Error(`YouTube upload: media file not found for ${mediaUrl}`);
      }

      // A REMOTE http(s) URL → download via the SSRF-hardened streamDownload
      // (re-guards every redirect hop against private/internal IPs, requires a
      // video content-type, size-capped) instead of a raw, unguarded axios GET.
      // We materialize to a temp file because googleapis' resumable upload can
      // retry the request body, which a one-shot network stream can't replay.
      const tmpDir = path.join(__dirname, '..', '..', 'uploads', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `yt-upload-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp4`);
      await downloadUtils.streamDownload(mediaUrl, tmpPath);
      return {
        stream: fs.createReadStream(tmpPath),
        cleanup: () => { try { fs.unlinkSync(tmpPath); } catch (_) { /* best effort */ } },
      };
    }

    throw new Error('YouTube upload requires either mediaPath (local file) or mediaUrl (http URL)');
  }

  /**
   * Uploads a video to YouTube
   */
  static async uploadToYouTube(auth, contentData) {
    const { title, description, tags = [] } = contentData;
    logger.info(`[YouTube] Preparing upload: ${title}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );

    oauth2Client.setCredentials({ access_token: auth.accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const { stream, cleanup } = await YouTubeSocialService._resolveUploadBody(contentData);
    try {
      const res = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title,
            description,
            tags,
            categoryId: '22' // People & Blogs
          },
          status: {
            privacyStatus: 'unlisted' // Default to unlisted for safety
          }
        },
        media: {
          body: stream
        }
      });

      logger.info(`[YouTube] Video uploaded successfully: ${res.data.id}`);
      return {
        id: res.data.id,
        url: `https://www.youtube.com/watch?v=${res.data.id}`
      };
    } catch (error) {
      logger.error('[YouTube] Upload failed', { error: error.message });
      throw error;
    } finally {
      cleanup();
    }
  }

  /**
   * Gets channel insights
   */
  static async getChannelInsights(auth) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: auth.accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    try {
      const res = await youtube.channels.list({
        part: 'statistics',
        mine: true
      });
      return res.data.items[0].statistics;
    } catch (error) {
      logger.error('[YouTube] Insights fetch failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete a YouTube video. Called by socialMediaService's delete switch (the
   * A/B auto-killer). Automatic deletion isn't wired yet, so we report this
   * HONESTLY (no fake success) instead of crashing the caller with "deleteVideo
   * is not a function". Mirrors the TikTok deletePost contract.
   */
  static async deleteVideo(_auth, videoId) {
    logger.info('[YouTube] delete requested — automatic deletion not wired', { videoId });
    return {
      success: false,
      platform: 'youtube',
      unsupported: true,
      videoId: videoId || null,
      message: 'Automatic deletion is not wired for YouTube yet. Remove the video in YouTube Studio.',
    };
  }
}

module.exports = YouTubeSocialService;

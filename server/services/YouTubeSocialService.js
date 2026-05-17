const { google } = require('googleapis');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

    // Stream from a URL. We materialize to a temp file rather than
    // piping the response straight into google's resumable upload —
    // googleapis sometimes retries the request body, and a one-shot
    // network stream can't be replayed without ECONNRESET.
    if (mediaUrl) {
      let url = mediaUrl;
      if (url.startsWith('/')) {
        const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
        url = `${baseUrl}${url}`;
      }
      const tmpDir = path.join(__dirname, '..', '..', 'uploads', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `yt-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
      const resp = await axios({ method: 'GET', url, responseType: 'stream', timeout: 60_000 });
      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(tmpPath);
        resp.data.pipe(w);
        w.on('finish', resolve);
        w.on('error', reject);
        resp.data.on('error', reject);
      });
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
}

module.exports = YouTubeSocialService;

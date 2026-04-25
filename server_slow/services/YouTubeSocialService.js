const { google } = require('googleapis');
const logger = require('../utils/logger');
const fs = require('fs');

class YouTubeSocialService {
  /**
   * Uploads a video to YouTube
   */
  static async uploadToYouTube(auth, contentData) {
    const { title, description, mediaPath, tags = [] } = contentData;
    logger.info(`[YouTube] Preparing upload: ${title}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );

    oauth2Client.setCredentials({ access_token: auth.accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

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
          body: fs.createReadStream(mediaPath)
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

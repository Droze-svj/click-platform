const axios = require('axios');
const logger = require('../utils/logger');

class MetaSocialService {
  /**
   * Posts to Instagram via the Content Publishing API
   * Requires a Facebook Page linked to an Instagram Business Account
   */
  static async postToInstagram(auth, contentData) {
    const { description, mediaUrl } = contentData;
    const { igUserId, accessToken } = auth; // Instagram Business Account ID

    if (!igUserId) throw new Error('Instagram User ID missing');

    logger.info(`[Instagram] Preparing media container: ${mediaUrl}`);

    try {
      // 1. Create Media Container
      const containerRes = await axios.post(
        `https://graph.facebook.com/v18.0/${igUserId}/media`,
        null,
        {
          params: {
            image_url: mediaUrl, // or video_url for reels
            caption: description,
            access_token: accessToken
          }
        }
      );

      const containerId = containerRes.data.id;
      logger.info(`[Instagram] Container created: ${containerId}. Waiting for processing...`);

      // 2. Publish Media
      const publishRes = await axios.post(
        `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: containerId,
            access_token: accessToken
          }
        }
      );

      logger.info(`[Instagram] Post successful: ${publishRes.data.id}`);
      return {
        id: publishRes.data.id,
        url: `https://www.instagram.com/reels/${publishRes.data.id}/` // Generic URL format
      };
    } catch (error) {
      logger.error('[Instagram] Post failed', { 
        error: error.response?.data || error.message 
      });
      throw error;
    }
  }

  /**
   * Posts to Facebook Page feed
   */
  static async postToFacebookPage(auth, contentData) {
    const { description, mediaUrl } = contentData;
    const { pageId, accessToken } = auth;

    logger.info(`[Facebook] Posting to page: ${pageId}`);

    try {
      const endpoint = mediaUrl ? `/${pageId}/photos` : `/${pageId}/feed`;
      const res = await axios.post(
        `https://graph.facebook.com/v18.0${endpoint}`,
        null,
        {
          params: {
            message: description,
            url: mediaUrl,
            access_token: accessToken
          }
        }
      );

      return {
        id: res.data.id,
        url: `https://www.facebook.com/${res.data.id}`
      };
    } catch (error) {
      logger.error('[Facebook] Post failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = MetaSocialService;

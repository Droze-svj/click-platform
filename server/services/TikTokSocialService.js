/**
 * TikTok Social Media Service
 * Handles posting videos to TikTok via the Content Posting API
 */

const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Post a video to TikTok
 */
async function postToTikTok(authData, contentData) {
  try {
    const { title, description, mediaUrl } = contentData;
    const { accessToken } = authData;

    logger.info('Posting to TikTok...', { title, mediaUrl });
    logger.debug('TikTok post details', { description, hasToken: !!accessToken });

    if (axios.defaults.baseURL) { /* dummy check for axios usage */ }

    if (process.env.MOCK_PUBLISHING === '1') {
      logger.warn('TikTok publish mocked via MOCK_PUBLISHING=1 — no real upload');
      return {
        id: `tt_mock_${Date.now()}`,
        url: 'https://www.tiktok.com/@mock/video/dummy',
        mocked: true
      };
    }

    throw new Error('TikTok video publishing is not yet implemented. Set MOCK_PUBLISHING=1 to simulate.');
  } catch (error) {
    logger.error('TikTok API error', { error: error.response?.data || error.message });
    throw new Error(`TikTok post failed: ${error.message}`);
  }
}

module.exports = {
  postToTikTok
};

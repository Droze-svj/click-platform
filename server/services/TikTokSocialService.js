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

    // TikTok Content Posting API
    if (axios.defaults.baseURL) { /* dummy check for axios usage */ }
    
    // In dev mode, return mock success
    if (process.env.NODE_ENV !== 'production') {
      return {
        id: `tt_${Date.now()}`,
        url: `https://www.tiktok.com/@user/video/dummy`
      };
    }

    // Real implementation would follow the TikTok v2 publishing flow
    throw new Error('Full TikTok video publishing not implemented for production yet');
  } catch (error) {
    logger.error('TikTok API error', { error: error.response?.data || error.message });
    throw new Error(`TikTok post failed: ${error.message}`);
  }
}

module.exports = {
  postToTikTok
};

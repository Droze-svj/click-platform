/**
 * Twitter/X Social Media Service
 * Specifically handles OAuth2.0 and posting to the Twitter API
 */

const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Post a tweet (text + optional media)
 */
async function postTweet(authData, contentData) {
  try {
    const { title, description, mediaUrl, tags = [] } = contentData;
    const { accessToken } = authData;

    logger.info('Posting to Twitter...', { title });

    // 1. Upload media if present (Twitter requires media upload first)
    let mediaId = null;
    if (mediaUrl) {
      mediaId = await uploadMedia(accessToken, mediaUrl);
    }

    // 2. Create the tweet
    const statusText = `${title}\n\n${description}\n\n${tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ')}`.substring(0, 280);
    
    // Using Twitter API v2
    const response = await axios.post('https://api.twitter.com/2/tweets', {
      text: statusText,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {})
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      id: response.data.data.id,
      url: `https://twitter.com/i/status/${response.data.data.id}`
    };
  } catch (error) {
    logger.error('Twitter API error', { error: error.response?.data || error.message });
    throw new Error(`Twitter post failed: ${error.message}`);
  }
}

/**
 * Internal helper to upload media to Twitter V1.1 (Media upload is still V1.1 mostly)
 */
async function uploadMedia(accessToken, mediaUrl) {
  logger.info('Uploading media to Twitter...', { mediaUrl });
  // In a real implementation, we'd download the media and POST it to media/upload
  // For now, return a placeholder ID if in dev
  if (process.env.NODE_ENV !== 'production') return 'mock_media_id_123';
  
  throw new Error('Twitter media upload not fully implemented for production yet');
}

module.exports = {
  postTweet
};

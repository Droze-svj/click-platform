/**
 * YouTube Social Media Service
 * Handles uploading videos via the YouTube Data API v3
 */

const logger = require('../utils/logger');
const axios = require('axios');
const fs = require('fs');

/**
 * Upload a video to YouTube
 */
async function uploadToYouTube(authData, contentData) {
  try {
    const { title, description, mediaUrl, tags = [] } = contentData;
    const { accessToken } = authData;

    logger.info('Uploading to YouTube...', { title, mediaUrl });

    // Validate if mediaUrl is a local file
    if (mediaUrl && mediaUrl.startsWith('/') && fs.existsSync(mediaUrl)) {
      logger.debug('Found local video file for YouTube upload', { path: mediaUrl });
    }

    // YouTube upload is a two-step process (Metadata then Media) or resumable
    // For this foundation, we'll implement the metadata structure
    
    // Using YouTube Data API v3
    // POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status
    const metadataResponse = await axios.post('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      snippet: {
        title: title.substring(0, 100),
        description: description.substring(0, 5000),
        tags: tags.slice(0, 20),
        categoryId: '22' // People & Blogs
      },
      status: {
        privacyStatus: 'unlisted', // Default to unlisted for safety
        selfDeclaredMadeForKids: false
      }
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4'
      }
    });

    const uploadUrl = metadataResponse.headers.location;
    logger.info('YouTube resumable upload URL obtained', { uploadUrl });

    if (process.env.MOCK_PUBLISHING === '1') {
      logger.warn('YouTube upload mocked via MOCK_PUBLISHING=1 — no media streamed');
      return {
        id: `yt_mock_${Date.now()}`,
        url: 'https://youtube.com/watch?v=dummy_yt_id',
        mocked: true
      };
    }

    throw new Error('YouTube video stream upload is not yet implemented. Set MOCK_PUBLISHING=1 to simulate.');
  } catch (error) {
    logger.error('YouTube API error', { error: error.response?.data || error.message });
    throw new Error(`YouTube upload failed: ${error.message}`);
  }
}

module.exports = {
  uploadToYouTube
};

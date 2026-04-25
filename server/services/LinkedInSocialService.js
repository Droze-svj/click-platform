const axios = require('axios');
const logger = require('../utils/logger');

class LinkedInSocialService {
  /**
   * Posts an update to LinkedIn (UGC Post API)
   */
  static async postToLinkedIn(auth, contentData) {
    const { title, description, mediaUrl } = contentData;
    logger.info(`[LinkedIn] Preparing post: ${title}`);

    const accessToken = auth.accessToken;
    let authorUrn = auth.linkedInUrn; 

    // If linkedInUrn is missing, try to construct it from platformUserId
    if (!authorUrn && auth.platformUserId) {
      authorUrn = `urn:li:person:${auth.platformUserId}`;
    }

    if (!authorUrn) throw new Error('LinkedIn URN or platformUserId missing from credentials');

    const apiUrl = 'https://api.linkedin.com/v2/ugcPosts';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json'
    };

    const postBody = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: `${title}\n\n${description}`
          },
          shareMediaCategory: mediaUrl ? 'ARTICLE' : 'NONE',
          media: mediaUrl ? [
            {
              status: 'READY',
              description: { text: title },
              originalUrl: mediaUrl,
              title: { text: title }
            }
          ] : []
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    try {
      const response = await axios.post(apiUrl, postBody, { headers });
      const postId = response.data.id;
      logger.info(`[LinkedIn] Post successful: ${postId}`);
      return {
        id: postId,
        url: `https://www.linkedin.com/feed/update/${postId}`
      };
    } catch (error) {
      logger.error('[LinkedIn] Post failed', { 
        error: error.response?.data || error.message 
      });
      throw error;
    }
  }

  /**
   * Syncs LinkedIn insights
   */
  static async getMemberInsights(auth) {
    // LinkedIn profile analytics logic
    return { success: true, message: 'Insights sync staged' };
  }
}

module.exports = LinkedInSocialService;

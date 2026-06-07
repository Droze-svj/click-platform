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
   * Fetch account-level member insights (network/follower size).
   *
   * Uses the real LinkedIn `networkSizes` endpoint. This requires the
   * `r_1st_connections_size` scope (or an organization context for Page
   * analytics) which LinkedIn grants selectively — most member tokens issued
   * for posting (`w_member_social`) do NOT include it, so the call returns a
   * 403.
   *
   * Honesty contract: on any failure (missing URN/token, missing scope,
   * network) we return `{ available: false, reason }` with NO fabricated
   * numbers. On success we return the real first-degree network size.
   */
  static async getMemberInsights(auth) {
    const accessToken = auth?.accessToken;
    let personId = auth?.platformUserId;
    if (!personId && auth?.linkedInUrn) {
      personId = String(auth.linkedInUrn).replace('urn:li:person:', '');
    }

    if (!accessToken || accessToken === 'dev-token') {
      return { available: false, platform: 'linkedin', reason: 'No LinkedIn access token available' };
    }
    if (!personId) {
      return { available: false, platform: 'linkedin', reason: 'LinkedIn person URN/platformUserId missing' };
    }

    try {
      const response = await axios.get(
        `https://api.linkedin.com/v2/networkSizes/urn:li:person:${personId}`,
        {
          params: { edgeType: 'CONNECTION' },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
          timeout: 10000,
        }
      );

      const followerCount = response.data?.firstDegreeSize;
      if (followerCount == null) {
        return {
          available: false,
          platform: 'linkedin',
          reason: 'LinkedIn returned no network size (likely missing r_1st_connections_size scope)',
        };
      }

      return {
        available: true,
        platform: 'linkedin',
        followerCount,
        // LinkedIn does not return following count or demographics for member
        // tokens; omit rather than fabricate.
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      const reason = error.response?.data?.message || error.message;
      logger.warn('[LinkedIn] getMemberInsights unavailable', { reason });
      return { available: false, platform: 'linkedin', reason };
    }
  }
}

module.exports = LinkedInSocialService;

const { TwitterApi } = require('twitter-api-v2');
const logger = require('../utils/logger');

class TwitterSocialService {
  /**
   * Posts a tweet with optional media
   */
  static async postTweet(auth, contentData) {
    const { title, description, mediaUrl, tags = [] } = contentData;
    logger.info(`[Twitter] Preparing tweet: ${title}`);

    // Initialize Twitter Client with OAuth 1.0a or 2.0 user tokens
    const client = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: auth.accessToken,
      accessSecret: auth.accessSecret // Required for OAuth 1.0a
    });

    try {
      const tweetText = `${title}\n\n${description}\n\n${tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ')}`;
      
      let tweet;
      if (mediaUrl && mediaUrl.startsWith('http')) {
        // In production, we'd download the media and upload via client.v1.uploadMedia
        logger.info('[Twitter] Media detected, attaching to tweet logic staged');
        // Mocking the media upload for now but using real text v2 API
        tweet = await client.v2.tweet(tweetText);
      } else {
        tweet = await client.v2.tweet(tweetText);
      }

      logger.info(`[Twitter] Tweet posted successfully: ${tweet.data.id}`);
      return {
        id: tweet.data.id,
        url: `https://twitter.com/i/web/status/${tweet.data.id}`
      };
    } catch (error) {
      logger.error('[Twitter] Tweet failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Gets user insights/metrics
   */
  static async getUserInsights(auth) {
    const client = new TwitterApi(auth.accessToken);
    try {
      const me = await client.v2.me({ 'user.fields': ['public_metrics'] });
      return me.data.public_metrics;
    } catch (error) {
      logger.error('[Twitter] Insights fetch failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a tweet
   */
  static async deleteTweet(auth, tweetId) {
    const client = new TwitterApi(auth.accessToken);
    try {
      await client.v2.deleteTweet(tweetId);
      return { success: true };
    } catch (error) {
      logger.error('[Twitter] Deletion failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = TwitterSocialService;

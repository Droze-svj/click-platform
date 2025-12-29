// Social media posting worker

const { createWorker } = require('../services/jobQueueService');
const { postToLinkedIn } = require('../services/linkedinOAuthService');
const { postToFacebook } = require('../services/facebookOAuthService');
const { postToInstagram } = require('../services/instagramOAuthService');
const { postTweet } = require('../services/twitterOAuthService');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Social media posting job processor
 */
async function processSocialPostJob(jobData, job) {
  const { 
    userId, 
    contentId, 
    platforms, 
    content, 
    scheduledPostId,
    options = {} 
  } = jobData;

  try {
    await job.updateProgress(0);
    logger.info('Starting social media post', {
      userId,
      contentId,
      platforms,
      jobId: job.id,
    });

    const results = [];
    const totalPlatforms = platforms.length;
    let completed = 0;

    // Post to each platform
    for (const platform of platforms) {
      try {
        await job.updateProgress((completed / totalPlatforms) * 100);

        let postResult;

        switch (platform.toLowerCase()) {
          case 'twitter':
            postResult = await postTweet(userId, content.text, options);
            break;
          case 'linkedin':
            postResult = await postToLinkedIn(userId, content.text, options);
            break;
          case 'facebook':
            postResult = await postToFacebook(userId, content.text, options);
            break;
          case 'instagram':
            if (!content.imageUrl) {
              throw new Error('Image URL required for Instagram');
            }
            postResult = await postToInstagram(
              userId,
              content.imageUrl,
              content.text,
              options
            );
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }

        results.push({
          platform,
          success: true,
          postId: postResult.id,
          url: postResult.url,
        });

        completed++;
        logger.info('Post successful', { platform, userId, jobId: job.id });
      } catch (error) {
        logger.error('Post failed for platform', {
          platform,
          userId,
          error: error.message,
        });

        results.push({
          platform,
          success: false,
          error: error.message,
        });

        // Continue with other platforms even if one fails
      }
    }

    await job.updateProgress(100);

    // Update scheduled post if exists
    if (scheduledPostId) {
      const scheduledPost = await ScheduledPost.findByIdAndUpdate(scheduledPostId, {
        $set: {
          status: 'posted',
          postedAt: new Date(),
          results,
        }
      }, { new: true });

      // Trigger webhook for successful posts
      if (scheduledPost) {
        const { triggerWebhook } = require('../services/webhookService');
        for (const result of results) {
          if (result.success) {
            await triggerWebhook(userId, 'post.posted', {
              postId: scheduledPostId,
              contentId,
              platform: result.platform,
              platformPostId: result.postId,
              platformPostUrl: result.url,
              postedAt: scheduledPost.postedAt
            }).catch(err => logger.warn('Webhook trigger failed', { error: err.message }));
          } else {
            await triggerWebhook(userId, 'post.failed', {
              postId: scheduledPostId,
              contentId,
              platform: result.platform,
              error: result.error
            }).catch(err => logger.warn('Webhook trigger failed', { error: err.message }));
          }
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('Social media posting completed', {
      userId,
      contentId,
      successCount,
      totalPlatforms,
      jobId: job.id,
    });

    return {
      success: successCount > 0,
      results,
      successCount,
      totalPlatforms,
    };
  } catch (error) {
    logger.error('Social media posting job failed', {
      userId,
      contentId,
      jobId: job.id,
      error: error.message,
    });

    // Update scheduled post status
    if (scheduledPostId) {
      await ScheduledPost.findByIdAndUpdate(scheduledPostId, {
        $set: { status: 'failed', error: error.message }
      }).catch(() => {});

      // Trigger webhook for failed post
      const { triggerWebhook } = require('../services/webhookService');
      await triggerWebhook(userId, 'post.failed', {
        postId: scheduledPostId,
        contentId,
        error: error.message
      }).catch(err => logger.warn('Webhook trigger failed', { error: err.message }));
    }

    captureException(error, {
      tags: { queue: 'social-posting', userId, contentId },
    });

    throw error;
  }
}

/**
 * Initialize social post worker
 */
function initializeSocialPostWorker() {
  const worker = createWorker('social-posting', processSocialPostJob, {
    concurrency: 5, // Process 5 posts concurrently
    limiter: {
      max: 20,
      duration: 60000, // Max 20 posts per minute (rate limit friendly)
    },
  });

  logger.info('Social media posting worker initialized');
  return worker;
}

module.exports = {
  initializeSocialPostWorker,
  processSocialPostJob,
};




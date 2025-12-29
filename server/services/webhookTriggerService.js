// Webhook Trigger Service
// Centralized webhook triggering for performance milestones

const { triggerWebhook } = require('./webhookService');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Check and trigger performance milestone webhooks
 */
async function checkPerformanceMilestones(userId, postId) {
  try {
    const post = await ScheduledPost.findById(postId)
      .populate('contentId')
      .lean();

    if (!post || !post.analytics) {
      return;
    }

    const engagement = post.analytics.engagement || 0;
    const impressions = post.analytics.impressions || 0;
    const engagementRate = impressions > 0 ? engagement / impressions : 0;

    // Define milestones
    const milestones = [
      { threshold: 100, name: '100_engagements' },
      { threshold: 500, name: '500_engagements' },
      { threshold: 1000, name: '1000_engagements' },
      { threshold: 5000, name: '5000_engagements' },
      { threshold: 10000, name: '10000_engagements' },
      { threshold: 50000, name: '50000_engagements' },
      { threshold: 100000, name: '100000_engagements' }
    ];

    // Check which milestone was reached
    for (const milestone of milestones) {
      if (engagement >= milestone.threshold) {
        // Check if we've already triggered this milestone
        const alreadyTriggered = post.metadata?.milestonesTriggered?.includes(milestone.name);
        
        if (!alreadyTriggered) {
          // Trigger webhook
          await triggerWebhook(userId, 'performance.milestone', {
            postId: post._id,
            contentId: post.contentId?._id || post.contentId,
            platform: post.platform,
            milestone: milestone.name,
            threshold: milestone.threshold,
            engagement,
            engagementRate,
            impressions,
            reachedAt: new Date()
          });

          // Mark as triggered
          await ScheduledPost.findByIdAndUpdate(postId, {
            $addToSet: { 'metadata.milestonesTriggered': milestone.name }
          });

          logger.info('Performance milestone reached', { 
            userId, 
            postId, 
            milestone: milestone.name,
            engagement 
          });
        }
      }
    }

    // Check threshold webhooks (custom thresholds)
    // This would be configured per user/webhook
    // For now, we'll trigger if engagement rate exceeds 10%
    if (engagementRate >= 0.10 && engagement >= 100) {
      await triggerWebhook(userId, 'performance.threshold', {
        postId: post._id,
        contentId: post.contentId?._id || post.contentId,
        platform: post.platform,
        threshold: 'high_engagement_rate',
        engagement,
        engagementRate,
        impressions,
        reachedAt: new Date()
      });
    }
  } catch (error) {
    logger.error('Error checking performance milestones', { error: error.message, postId });
  }
}

/**
 * Monitor post performance and trigger milestones
 */
async function monitorPostPerformance(postId) {
  try {
    await checkPerformanceMilestones(null, postId);
  } catch (error) {
    logger.error('Error monitoring post performance', { error: error.message, postId });
  }
}

module.exports = {
  checkPerformanceMilestones,
  monitorPostPerformance
};



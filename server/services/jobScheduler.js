// Job Scheduler Service
// Handles scheduled and recurring jobs

const cron = require('node-cron');
const logger = require('../utils/logger');
const { addJob, QUEUE_NAMES, JOB_PRIORITY } = require('../queues');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');

/**
 * Schedule a one-time job
 */
async function scheduleJob(queueName, jobData, scheduleTime, options = {}) {
  const delay = Math.max(0, new Date(scheduleTime).getTime() - Date.now());
  
  if (delay === 0) {
    // Execute immediately
    return addJob(queueName, jobData, options);
  }

  return addJob(queueName, jobData, {
    ...options,
    delay,
  });
}

/**
 * Process scheduled posts
 */
async function processScheduledPosts() {
  try {
    const now = new Date();
    // Safety hold: skip posts whose holdUntil hasn't passed yet. Users get
    // a guaranteed cancel window between schedule-time and the cron pickup.
    // null/missing holdUntil means "no hold needed" — usually because the
    // post was created with a long enough lead time that the safety window
    // has already elapsed by the time the scheduledTime arrives.
    // Picks up two kinds of rows:
    //   1. Freshly-scheduled posts whose scheduledTime + holdUntil have passed.
    //   2. failed_retryable rows whose nextRetryAt has elapsed — these are
    //      transient failures (network/timeout/rate-limit) the worker
    //      classified for backoff retry. Permanent failures stay parked.
    const upcomingPosts = await ScheduledPost.find({
      $or: [
        {
          status: 'scheduled',
          scheduledTime: { $lte: now },
          $or: [
            { holdUntil: null },
            { holdUntil: { $exists: false } },
            { holdUntil: { $lte: now } },
          ],
        },
        {
          status: 'failed_retryable',
          nextRetryAt: { $lte: now },
        },
      ],
    })
      .limit(100)
      .maxTimeMS(5000)
      .lean();

    logger.info('Processing scheduled posts', { count: upcomingPosts.length });

    for (const post of upcomingPosts) {
      try {
        // Add to social posting queue. Pass through dryRun so the worker
        // can simulate the publish without hitting real platform APIs.
        await addJob(QUEUE_NAMES.SOCIAL_POSTING, {
          name: 'scheduled-post',
          data: {
            userId: post.userId,
            contentId: post.contentId,
            platform: post.platform,
            content: post.content,
            scheduledPostId: post._id,
            dryRun: post.dryRun === true,
            options: post.options || {},
          },
        }, {
          priority: JOB_PRIORITY.HIGH,
        });

        logger.info('Scheduled post queued', { postId: post._id, dryRun: post.dryRun === true });
      } catch (error) {
        logger.error('Failed to queue scheduled post', {
          postId: post._id,
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to process scheduled posts', { error: error.message });
  }
}

/**
 * Reset posts stuck in `publishing` state. If the worker crashes between
 * flipping a post to `publishing` and writing its final status, the row
 * parks forever — the scheduler cron won't pick it up (it only scans
 * `scheduled` + `failed_retryable`) and the dashboard shows "still
 * publishing" indefinitely. We sweep anything stuck >10 minutes back to
 * `scheduled` so the next cron tick re-queues it. attemptCount goes up
 * so a permanently bad post eventually flips to `failed_permanent`.
 */
async function resetStuckPublishing() {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const result = await ScheduledPost.updateMany(
      {
        status: 'publishing',
        // Use `updatedAt` if the schema has it; otherwise fall back to
        // `scheduledTime` which is always set. Either way, only sweep
        // rows that have been in `publishing` long enough that we're
        // confident the worker is gone, not just slow.
        $or: [
          { updatedAt: { $lt: cutoff } },
          { updatedAt: { $exists: false }, scheduledTime: { $lt: cutoff } },
        ],
      },
      {
        $set: { status: 'scheduled' },
        $inc: { attemptCount: 1 },
      },
    );
    if (result?.modifiedCount > 0) {
      logger.info('Reset stuck-publishing posts', { count: result.modifiedCount });
    }
  } catch (error) {
    logger.error('Failed to reset stuck-publishing posts', { error: error.message });
  }
}

/**
 * Clean up old completed jobs
 */
async function cleanupOldJobs() {
  try {
    const { cleanAllQueues } = require('../queues');
    await cleanAllQueues(24 * 3600 * 1000); // 24 hours grace period
    logger.info('Old jobs cleaned up');
  } catch (error) {
    logger.error('Failed to cleanup old jobs', { error: error.message });
  }
}

/**
 * Clean up dead letter jobs
 */
async function cleanupDeadLetterJobs() {
  try {
    const { cleanupDeadLetterJobs } = require('./jobDeadLetterService');
    const deleted = await cleanupDeadLetterJobs(30); // 30 days
    logger.info('Dead letter jobs cleaned up', { deleted });
  } catch (error) {
    logger.error('Failed to cleanup dead letter jobs', { error: error.message });
  }
}

/**
 * Initialize job scheduler
 */
function initializeScheduler() {
  // Process scheduled posts every minute
  cron.schedule('* * * * *', async () => {
    await processScheduledPosts();
  });

  // Sweep stuck-publishing posts every 5 min. This is a recovery path
  // for worker crashes mid-publish — without it, a single bad shutdown
  // can leave a creator's post "publishing forever" with no way out.
  cron.schedule('*/5 * * * *', async () => {
    await resetStuckPublishing();
  });

  // Cleanup old jobs daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    await cleanupOldJobs();
  });

  // Cleanup dead letter jobs weekly on Sunday at 3 AM
  cron.schedule('0 3 * * 0', async () => {
    await cleanupDeadLetterJobs();
  });

  // Process auto-reposts every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const { processPendingReposts } = require('./autoRepostScheduler');
      const results = await processPendingReposts();
      logger.info('Auto-reposts processed', results);
    } catch (error) {
      logger.error('Error processing auto-reposts', { error: error.message });
    }
  });

  // Check search alerts every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const { checkSearchAlerts } = require('./searchAlertService');
      const results = await checkSearchAlerts();
      logger.info('Search alerts checked', results);
    } catch (error) {
      logger.error('Error checking search alerts', { error: error.message });
    }
  });

  // Check benchmark alerts every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const User = require('../models/User');
      const { checkBenchmarkAlerts } = require('./contentBenchmarkingService');
      
      const users = await User.find({}).select('_id').lean();
      let totalChecked = 0;
      let totalTriggered = 0;

      for (const user of users) {
        try {
          const result = await checkBenchmarkAlerts(user._id);
          totalChecked += result.checked;
          totalTriggered += result.triggered;
        } catch (error) {
          logger.error('Error checking benchmark alerts for user', { error: error.message, userId: user._id });
        }
      }

      logger.info('Benchmark alerts checked', { totalChecked, totalTriggered });
    } catch (error) {
      logger.error('Error checking benchmark alerts', { error: error.message });
    }
  });

  // Update goal progress daily
  cron.schedule('0 2 * * *', async () => {
    try {
      const User = require('../models/User');
      const { updateGoalProgress } = require('./benchmarkGoalService');
      
      const users = await User.find({}).select('_id').lean();
      let totalUpdated = 0;

      for (const user of users) {
        try {
          const result = await updateGoalProgress(user._id);
          totalUpdated += result.updated;
        } catch (error) {
          logger.error('Error updating goal progress', { error: error.message, userId: user._id });
        }
      }

      logger.info('Goal progress updated', { totalUpdated });
    } catch (error) {
      logger.error('Error updating goal progress', { error: error.message });
    }
  });

  // Execute curation rules daily
  cron.schedule('0 3 * * *', async () => {
    try {
      const User = require('../models/User');
      const { executeAllActiveRules } = require('./curationRuleService');
      
      const users = await User.find({}).select('_id').lean();
      let totalExecuted = 0;
      let totalCurated = 0;

      for (const user of users) {
        try {
          const result = await executeAllActiveRules(user._id);
          totalExecuted += result.executed;
          totalCurated += result.results.reduce((sum, r) => sum + (r.curated || 0), 0);
        } catch (error) {
          logger.error('Error executing curation rules', { error: error.message, userId: user._id });
        }
      }

      logger.info('Curation rules executed', { totalExecuted, totalCurated });
    } catch (error) {
      logger.error('Error executing curation rules', { error: error.message });
    }
  });

  // Check audience alerts every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const User = require('../models/User');
      const { checkAudienceAlerts } = require('./audienceAlertService');
      
      const users = await User.find({}).select('_id').lean();
      let totalChecked = 0;
      let totalTriggered = 0;

      for (const user of users) {
        try {
          const result = await checkAudienceAlerts(user._id);
          totalChecked += result.checked;
          totalTriggered += result.triggered;
        } catch (error) {
          logger.error('Error checking audience alerts', { error: error.message, userId: user._id });
        }
      }

      logger.info('Audience alerts checked', { totalChecked, totalTriggered });
    } catch (error) {
      logger.error('Error checking audience alerts', { error: error.message });
    }
  });

  // Check repost alerts every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const User = require('../models/User');
      const { checkRepostAlerts } = require('./repostAlertService');
      
      const users = await User.find({}).select('_id').lean();
      let totalChecked = 0;
      let totalTriggered = 0;

      for (const user of users) {
        try {
          const result = await checkRepostAlerts(user._id);
          totalChecked += result.checked;
          totalTriggered += result.triggered;
        } catch (error) {
          logger.error('Error checking repost alerts', { error: error.message, userId: user._id });
        }
      }

      logger.info('Repost alerts checked', { totalChecked, totalTriggered });
    } catch (error) {
      logger.error('Error checking repost alerts', { error: error.message });
    }
  });

  // Process recurring schedules every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const { processRecurringSchedules } = require('./advancedSchedulingService');
      const results = await processRecurringSchedules();
      logger.info('Recurring schedules processed', results);
    } catch (error) {
      logger.error('Error processing recurring schedules', { error: error.message });
    }
  });

  // Process always-on libraries every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const { processActiveLibraries } = require('./alwaysOnLibraryService');
      const results = await processActiveLibraries();
      logger.info('Always-on libraries processed', { count: results.length });
    } catch (error) {
      logger.error('Error processing always-on libraries', { error: error.message });
    }
  });

  logger.info('✅ Job scheduler initialized');
}

module.exports = {
  scheduleJob,
  processScheduledPosts,
  cleanupOldJobs,
  initializeScheduler,
  // Exported so the LIVE scheduler cron (routes/scheduler.js) can recover posts
  // stranded in 'publishing' by a crashed worker, even though this module's own
  // cron (initializeScheduler) isn't started.
  resetStuckPublishing,
};


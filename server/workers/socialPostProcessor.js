// Social media posting worker

const { createWorker } = require('../services/jobQueueService');
const { postToLinkedIn } = require('../services/linkedinOAuthService');
const { postToFacebook } = require('../services/facebookOAuthService');
const { postToInstagram } = require('../services/instagramOAuthService');
const twitterOAuth = require('../services/twitterOAuthService');
const tiktokOAuth = require('../services/tiktokOAuthService');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

// Two ways to land in dry-run mode:
//   1. DRY_RUN_PUBLISH=true env var → every post is simulated.
//   2. The ScheduledPost has dryRun:true on the document → only that post
//      is simulated. Lets one creator test live while another tests safely.
const DRY_RUN_GLOBAL = process.env.DRY_RUN_PUBLISH === 'true';

function simulatedResult(platform) {
  return {
    id: `dryrun-${platform}-${Date.now()}`,
    url: `https://example.com/dryrun/${platform}/${Date.now()}`,
    dryRun: true,
  };
}

/**
 * Classify a publish failure as retryable or permanent. The cron will only
 * re-queue rows tagged `failed_retryable`; `failed_permanent` rows park
 * and surface to the dashboard for the user to act on.
 *
 * Transient (retryable): network timeouts, 5xx, 429 rate limit, ECONNRESET.
 * Permanent: 401/403 auth, 400 invalid input, "Account not linked", quota.
 */
function classifyPublishError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const status = error?.response?.status || error?.statusCode;
  if (status === 429 || (status >= 500 && status < 600)) return 'failed_retryable';
  if (msg.includes('etimedout') || msg.includes('econnreset') || msg.includes('socket hang up') || msg.includes('network')) {
    return 'failed_retryable';
  }
  if (status === 401 || status === 403) return 'failed_permanent';
  if (msg.includes('not connected') || msg.includes('not linked') || msg.includes('invalid_grant') || msg.includes('token expired')) {
    return 'failed_permanent';
  }
  // Unknown failure — bias to retryable so transient hiccups don't bury
  // posts. Backoff caps attempts so we don't loop forever.
  return 'failed_retryable';
}

/** Exponential backoff: attempt 0 → 1m, 1 → 5m, 2 → 25m, 3+ → permanent. */
function nextRetryDelay(attemptCount) {
  if (attemptCount >= 3) return null;
  const minutes = [1, 5, 25][attemptCount] || 25;
  return minutes * 60 * 1000;
}

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
    dryRun: jobDryRun,
    options = {}
  } = jobData;

  // Final cancel check — the user might have hit Cancel after the job was
  // queued but before this worker picked it up. Honour that.
  if (scheduledPostId) {
    const fresh = await ScheduledPost.findById(scheduledPostId).select('status dryRun').lean();
    if (fresh?.status === 'cancelled') {
      logger.info('Social post job skipped — cancelled by user', { scheduledPostId });
      return { success: true, skipped: 'cancelled', results: [] };
    }
    // Per-post dryRun overrides the job-payload value if it changed.
    if (fresh?.dryRun) jobData.dryRun = true;
    // Flip to 'publishing' so the dashboard shows a live status — the
    // window between cron pickup and the final 'posted'/'failed_*' write
    // can be several seconds when the platform is slow.
    await ScheduledPost.findByIdAndUpdate(scheduledPostId, { $set: { status: 'publishing' } })
      .catch((dbErr) => logger.warn('Could not mark post as publishing', { scheduledPostId, error: dbErr.message }));
  }
  const dryRun = DRY_RUN_GLOBAL || jobDryRun === true || jobData.dryRun === true;

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

        // DRY_RUN gate: simulate success WITHOUT calling any platform API.
        // The simulated result keeps the same shape downstream consumers
        // expect, so analytics-sync, webhook triggers, and the learning
        // loop all proceed normally — they just operate on a fake postId.
        if (dryRun) {
          logger.info('[DRY_RUN] simulating publish', { platform, userId, scheduledPostId });
          postResult = simulatedResult(platform);
        } else {
          switch (platform.toLowerCase()) {
          case 'twitter':
            postResult = await twitterOAuth.postTweetForUser(userId, content.text, options, options.platform_user_id);
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
          case 'tiktok':
            // TikTok was previously unhandled here → every scheduled TikTok post
            // failed with a generic "Unsupported platform". Routed to the real
            // Content Posting API: postToTikTok uploads a local videoPath directly,
            // OR downloads a remote mediaUrl to a temp file first (SSRF-guarded,
            // size-capped, auto-cleaned) since the API needs the bytes. It throws
            // a specific, honest error if neither is usable — never a fake success.
            if (!tiktokOAuth.isConfigured()) {
              throw new Error('TikTok OAuth not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.');
            }
            postResult = await tiktokOAuth.postToTikTok(userId, {
              videoPath: content.videoPath || options.videoPath,
              mediaUrl: content.mediaUrl || content.videoUrl || options.mediaUrl,
            });
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
          }
        }

        results.push({
          platform,
          success: true,
          postId: postResult.id,
          url: postResult.url,
          dryRun: !!postResult.dryRun,
        });

        completed++;
        logger.info('Post successful', { platform, userId, jobId: job.id, dryRun: !!postResult.dryRun });
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

      // Best-effort immediate ingest. The platform's real analytics
      // numbers only land later (engagement, impressions, retention all
      // take 24h+ to settle), but we still want the *style picks* —
      // hook angle, caption style, color grade — folded into the
      // learning profile right now so the very next suggestion benefits.
      // The 6h cron will pick up the real metrics when they arrive.
      if (scheduledPost && scheduledPost.contentId) {
        const { ingestPostPerformance } = require('../services/creatorPerformanceService');
        ingestPostPerformance({
          userId: scheduledPost.userId,
          contentId: scheduledPost.contentId,
          metrics: scheduledPost.analytics || { views: 0, engagement: 0 },
        }).catch((err) => {
          // Non-blocking — if ingestion fails the cron will catch it later.
          logger.warn('Post-publish ingest failed (will retry via cron)', {
            scheduledPostId, error: err.message,
          });
        });
      }

      // Trigger webhook + emit socket event + create in-app notifications
      // so the dashboard updates live without a page refresh.
      if (scheduledPost) {
        const { triggerWebhook } = require('../services/webhookService');
        const { emitToUser } = require('../services/socketService');
        const notificationService = require('../services/notificationService');

        for (const result of results) {
          // Live socket update for any open dashboard tabs
          emitToUser(userId, 'post:status', {
            postId: scheduledPostId,
            platform: result.platform,
            status: result.success ? 'published' : 'failed',
            url: result.url || null,
            error: result.error || null,
            dryRun: !!result.dryRun,
          });

          // In-app notification (best-effort)
          try {
            if (result.success) {
              await notificationService.createNotification(
                userId,
                `${result.platform} post published`,
                result.dryRun
                  ? `Dry-run completed for ${result.platform}.`
                  : `Your ${result.platform} post is live${result.url ? ` — ${result.url}` : ''}.`,
                'success',
                '/dashboard/posts',
                { category: 'publishing', priority: 'normal', context: { postId: String(scheduledPostId), platform: result.platform } }
              );
            } else {
              await notificationService.createNotification(
                userId,
                `${result.platform} post failed`,
                result.error || `Your ${result.platform} post could not be published.`,
                'error',
                '/dashboard/scheduler',
                { category: 'publishing', priority: 'high', context: { postId: String(scheduledPostId), platform: result.platform } }
              );
            }
          } catch (notifErr) {
            logger.warn('Notification create failed', { error: notifErr.message, postId: scheduledPostId });
          }

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

    // Update scheduled post status — classify retryable vs permanent so
    // the cron knows whether to re-queue or park.
    if (scheduledPostId) {
      try {
        const current = await ScheduledPost.findById(scheduledPostId).select('attemptCount').lean();
        const attempt = (current?.attemptCount || 0) + 1;
        const classification = classifyPublishError(error);
        const delay = classification === 'failed_retryable' ? nextRetryDelay(current?.attemptCount || 0) : null;
        const finalStatus = (classification === 'failed_retryable' && delay !== null) ? 'failed_retryable' : 'failed_permanent';
        await ScheduledPost.findByIdAndUpdate(scheduledPostId, {
          $set: {
            status: finalStatus,
            error: error.message,
            attemptCount: attempt,
            nextRetryAt: delay !== null ? new Date(Date.now() + delay) : null,
          },
        });
      } catch (dbErr) {
        logger.error('Failed to mark scheduled post as failed', {
          scheduledPostId, error: dbErr.message,
        });
      }

      // Notify the user live + by webhook
      try {
        const { emitToUser } = require('../services/socketService');
        emitToUser(userId, 'post:status', {
          postId: scheduledPostId,
          status: 'failed',
          error: error.message,
        });
        const notificationService = require('../services/notificationService');
        await notificationService.createNotification(
          userId,
          'Scheduled post failed',
          error.message || 'The post could not be published.',
          'error',
          '/dashboard/scheduler',
          { category: 'publishing', priority: 'high', context: { postId: String(scheduledPostId) } }
        );
      } catch (notifErr) {
        logger.warn('Failure notification could not be created', { error: notifErr.message });
      }

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

  logger.info('Social media posting worker initialized', {
    dryRunGlobal: DRY_RUN_GLOBAL,
  });

  // Heartbeat — every 60s logs that the worker is alive so a silent crash
  // (e.g. uncaught exception in a handler) becomes visible in the log.
  // Skipped in test mode to avoid leaking timers.
  if (process.env.NODE_ENV !== 'test') {
    const heartbeat = setInterval(() => {
      logger.info('[heartbeat] social-posting worker alive', {
        dryRunGlobal: DRY_RUN_GLOBAL,
      });
    }, 60_000);
    heartbeat.unref?.();
  }

  return worker;
}

module.exports = {
  initializeSocialPostWorker,
  processSocialPostJob,
};




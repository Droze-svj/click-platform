const express = require('express');
const mongoose = require('mongoose');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const cron = process.env.NODE_ENV === 'test' 
  ? { schedule: () => ({ start: () => {}, stop: () => {} }) } 
  : require('node-cron');
const { getOptimalPostingWindows } = require('../services/optimalPostingTimeService');
const logger = require('../utils/logger');
const router = express.Router();

// Supabase users have UUID ids on `req.user.id`; Mongoose users have ObjectId
// on `req.user._id`. ScheduledPost.userId is typed as String so it accepts
// either, but Mongo-only operations (User.findByIdAndUpdate) must be guarded.
const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

/**
 * Emit an in-app notification when a scheduled post fails. Best-effort:
 * a notification failure must NOT cascade into a second cron error,
 * since the post status is already saved. Lazy-required so the cron
 * works even if notificationService isn't loaded for some reason.
 */
async function emitFailureNotification(post, reason) {
  try {
    const notificationService = require('../services/notificationService');
    await notificationService.createNotification(
      post.userId,
      'Scheduled post failed',
      reason || `Your ${post.platform} post couldn't be published. Open the scheduler for details.`,
      'error',
      '/dashboard/scheduler',
      {
        category: 'publishing',
        priority: 'high',
        context: {
          postId: String(post._id),
          platform: post.platform,
          scheduledTime: post.scheduledTime,
        },
      }
    );
  } catch (err) {
    logger.warn('emitFailureNotification: notification create failed', {
      postId: post?._id,
      error: err.message,
    });
  }
}

// Get optimal posting windows derived from a user's real per-platform engagement.
// `confident: true` means at least one platform's windows came from the creator's
// OWN posts (source:'your-history'). When history is thin it falls back to a
// clearly-labeled generic niche default (source:'niche-default', usedFallback:true)
// so the UI can still suggest a slot — honestly flagged as not-yet-personalized.
router.get('/optimal-times', auth, asyncHandler(async (req, res) => {
  const { platform, timezone, lookbackDays } = req.query;
  const result = await getOptimalPostingWindows(req.user._id || req.user.id, {
    platform: platform || null,
    timezone: timezone || null,
    lookbackDays: lookbackDays ? parseInt(lookbackDays, 10) : undefined,
  });
  res.json({ success: true, data: result });
}));

// Schedule a post
// Safety hold defaults — configurable via env so production can shorten or
// disable them once the user is comfortable. Two minutes is the sweet spot
// for testing: long enough to undo a click, short enough to stay snappy.
const SAFETY_HOLD_MINUTES = Math.max(0, Number(process.env.SAFETY_HOLD_MINUTES ?? 2));
const DEFAULT_DRY_RUN = process.env.DRY_RUN_PUBLISH === 'true';

router.post('/schedule', auth, async (req, res) => {
  try {
    const { contentId, platform, content, scheduledTime, mediaUrl, hashtags, dryRun, accountId } = req.body;

    // Structured validation — the prior code accepted empty text and
    // 500'd opaquely on invalid timestamps. Each branch now returns an
    // actionable `code` the client can map to a translation key.
    if (!platform) {
      return res.status(400).json({ error: 'Platform is required', code: 'PLATFORM_REQUIRED' });
    }
    if (!scheduledTime) {
      return res.status(400).json({ error: 'Scheduled time is required', code: 'SCHEDULED_TIME_REQUIRED' });
    }
    const when = new Date(scheduledTime);
    if (!Number.isFinite(when.getTime())) {
      return res.status(400).json({
        error: 'scheduledTime is not a valid date',
        code: 'SCHEDULED_TIME_INVALID',
        details: `Got: ${JSON.stringify(scheduledTime)}`,
      });
    }
    // Content can be a plain string (legacy clients) or an object
    // with { text, mediaUrl, hashtags } (new clients). Normalise both.
    const text = typeof content === 'string' ? content : (content?.text || '');
    const finalMediaUrl = mediaUrl || content?.mediaUrl || '';
    const finalHashtags = Array.isArray(hashtags)
      ? hashtags
      : (Array.isArray(content?.hashtags) ? content.hashtags : []);
    if (!text.trim() && !finalMediaUrl) {
      return res.status(400).json({
        error: 'Post needs text content or a mediaUrl',
        code: 'CONTENT_EMPTY',
      });
    }

    // Pre-flight: confirm the user actually has a connected account on this
    // platform (and that the requested accountId, if any, exists). Catching
    // this here means the schedule never enters the queue with credentials
    // we can't fulfil — instead of failing opaquely at publish-time, the
    // composer gets a clear 400 the UI can route to a "Connect …" prompt.
    try {
      const oauthService = require('../services/oauthService');
      const accounts = await oauthService.listSocialAccounts(
        req.user._id || req.user.id,
        platform,
      );
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({
          error: `No connected ${platform} account. Connect ${platform} first.`,
          code: 'PLATFORM_NOT_CONNECTED',
          platform,
        });
      }
      if (accountId && !accounts.some((a) => a.accountId === accountId || a.platformUserId === accountId)) {
        return res.status(400).json({
          error: `Selected ${platform} account is no longer connected.`,
          code: 'ACCOUNT_NOT_CONNECTED',
          platform,
          accountId,
        });
      }
    } catch (preflightErr) {
      // Don't 500 the publish on a transient storage hiccup — log and let
      // the worker surface the real failure if it actually can't load
      // credentials at run-time.
      logger.warn('Schedule pre-flight account check failed; continuing', {
        userId: req.user?._id || req.user?.id,
        platform,
        error: preflightErr.message,
      });
    }

    // Compute the cancel-window cutoff. The cron picks up posts only after
    // both `scheduledTime` AND `holdUntil` have passed. Posts scheduled
    // far in the future already have ample cancel time, so we only set the
    // hold when the gap from now is less than the safety window.
    const now = new Date();
    const holdMs = SAFETY_HOLD_MINUTES * 60 * 1000;
    const minPickup = new Date(Math.max(when.getTime(), now.getTime() + holdMs));
    const holdUntil = SAFETY_HOLD_MINUTES > 0 ? minPickup : null;

    const scheduledPost = new ScheduledPost({
      userId: req.user._id || req.user.id,
      contentId: contentId || null,
      platform,
      // Multi-account: when the client passed an accountId, persist it so
      // the worker knows which connected account to publish from. Without
      // one, the worker falls back to the user's active/primary account.
      accountId: accountId || null,
      content: {
        text,
        mediaUrl: finalMediaUrl,
        hashtags: finalHashtags,
      },
      scheduledTime: when,
      holdUntil,
      dryRun: typeof dryRun === 'boolean' ? dryRun : DEFAULT_DRY_RUN,
      status: 'scheduled'
    });

    await scheduledPost.save();

    // Update usage counter — only meaningful for legacy Mongo users.
    // Supabase users don't have a Mongo doc to increment, so skip silently.
    if (isMongoUserId(req.user._id || req.user.id)) {
      await User.findByIdAndUpdate(req.user._id || req.user.id, {
        $inc: { 'usage.postsScheduled': 1 }
      });
    }

    // Trigger webhook
    const { triggerWebhook } = require('../services/webhookService');
    await triggerWebhook(req.user._id || req.user.id, 'post.scheduled', {
      postId: scheduledPost._id,
      contentId: contentId || null,
      platform,
      scheduledTime: scheduledPost.scheduledTime,
      holdUntil: scheduledPost.holdUntil,
      dryRun: scheduledPost.dryRun,
    }).catch(err => logger.error('Webhook trigger failed', { error: err.message }));

    res.json({
      message: 'Post scheduled successfully',
      post: scheduledPost,
      // Surface the cancel window explicitly so the UI can show a
      // countdown and a Cancel button without hitting another endpoint.
      cancellableUntil: scheduledPost.holdUntil,
      dryRun: scheduledPost.dryRun,
    });
  } catch (error) {
    // Schedule failures hit the user in a "queue post" flow — generic 500
    // messages stranded them. Surface a tiny structured shape so the UI
    // can render a translatable toast + a Retry button on transient
    // errors. Validation errors are already returned 400 above; anything
    // here is an actual server problem.
    logger.error('Schedule create failed', {
      userId: req.user?._id || req.user?.id,
      platform: req.body?.platform,
      error: error.message,
    });
    const msg = error.name === 'ValidationError'
      ? `Invalid post fields: ${Object.keys(error.errors || {}).join(', ')}`
      : (error.message || 'Could not schedule post');
    res.status(500).json({
      error: msg,
      code: error.code || (error.name === 'ValidationError' ? 'SCHEDULE_VALIDATION' : 'SCHEDULE_INTERNAL'),
    });
  }
});

/**
 * POST /api/scheduler/:postId/cancel
 * Hard-stop a post before it leaves the cancel window.
 * - Returns 409 if the post is already past its holdUntil (the worker may
 *   have already picked it up).
 * - Returns 410 if the post is already published / failed / cancelled.
 * - On success the post status flips to 'cancelled' and the worker query
 *   in jobScheduler.processScheduledPosts will skip it forever.
 */
router.post('/:postId/cancel', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await ScheduledPost.findOne({ _id: postId, userId: req.user._id || req.user.id });
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    if (['posted', 'failed', 'cancelled'].includes(post.status)) {
      return res.status(410).json({
        success: false,
        error: `Post is already ${post.status}; cannot cancel.`,
        status: post.status,
      });
    }

    const now = new Date();
    const pastHold = post.holdUntil && post.holdUntil <= now;
    const pastSchedule = post.scheduledTime <= now;
    if (pastHold && pastSchedule) {
      // The post may already be in the worker queue. We still mark it
      // cancelled — the worker will see the status flip and abort — but
      // we warn the caller that the worker may win the race.
      post.status = 'cancelled';
      await post.save();
      return res.status(409).json({
        success: true,
        warning: 'Cancel window has passed. Marked cancelled but the worker may have already published.',
        post,
      });
    }

    post.status = 'cancelled';
    await post.save();

    const { triggerWebhook } = require('../services/webhookService');
    await triggerWebhook(req.user._id || req.user.id, 'post.cancelled', {
      postId: post._id,
      contentId: post.contentId,
      platform: post.platform,
    }).catch(err => logger.warn('Webhook trigger failed', { error: err.message }));

    res.json({ success: true, post });
  } catch (error) {
    logger.error('[scheduler] cancel failed', { error: error.message, postId: req.params.postId });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get scheduled posts
router.get('/', auth, async (req, res) => {
  try {
    const { platform, status, startDate, endDate } = req.query;

    const query = { userId: req.user._id || req.user.id };
    if (platform) query.platform = platform;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.scheduledTime = {};
      if (startDate) query.scheduledTime.$gte = new Date(startDate);
      if (endDate) query.scheduledTime.$lte = new Date(endDate);
    }

    const posts = await ScheduledPost.find(query)
      .sort({ scheduledTime: 1 })
      .limit(100);

    res.json({
      success: true,
      data: posts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update scheduled post
router.put('/:postId', auth, async (req, res) => {
  try {
    const post = await ScheduledPost.findOne({
      _id: req.params.postId,
      userId: req.user._id || req.user.id
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const { content, scheduledTime, status } = req.body;

    if (content) post.content = { ...post.content, ...content };
    if (scheduledTime) post.scheduledTime = new Date(scheduledTime);
    if (status) post.status = status;

    await post.save();

    res.json({
      message: 'Post updated',
      post
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete scheduled post
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await ScheduledPost.findOne({
      _id: req.params.postId,
      userId: req.user._id || req.user.id
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postId = post._id;
    await post.deleteOne();

    // Trigger webhook
    const { triggerWebhook } = require('../services/webhookService');
    await triggerWebhook(req.user._id || req.user.id, 'post.cancelled', {
      postId: postId.toString(),
      platform: post.platform
    }).catch(err => logger.error('Webhook trigger failed', { error: err.message }));

    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get calendar view
router.get('/calendar', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const endDate = new Date(year || new Date().getFullYear(), month || new Date().getMonth(), 0);

    const posts = await ScheduledPost.find({
      userId: req.user._id || req.user.id,
      scheduledTime: { $gte: startDate, $lte: endDate }
    }).sort({ scheduledTime: 1 });

    // Group by date
    const calendar = {};
    posts.forEach(post => {
      const date = post.scheduledTime.toISOString().split('T')[0];
      if (!calendar[date]) calendar[date] = [];
      calendar[date].push(post);
    });

    res.json(calendar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process scheduled posts (runs every minute)

cron.schedule('* * * * *', async () => {
  try {
    // Check if MongoDB is connected before attempting queries
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected - skip this cron run silently
      // Only log once per minute to avoid spam
      if (Date.now() % 60000 < 1000) { // Log roughly once per minute
        logger.debug('Skipping scheduled posts processing - MongoDB not connected', {
          readyState: mongoose.connection.readyState
        });
      }
      return;
    }

    const now = new Date();

    // Recover posts stranded in 'publishing' by a crashed/killed worker — the
    // claim flips scheduled→publishing, so a crash mid-post leaves the row
    // unselectable forever (this cron only scans 'scheduled'). Sweep ~every 5
    // min back to 'scheduled' so the next tick re-queues them.
    if (now.getMinutes() % 5 === 0) {
      try {
        await require('../services/jobScheduler').resetStuckPublishing();
      } catch (e) {
        logger.warn('stuck-publishing recovery failed', { error: e.message });
      }
    }

    const posts = await ScheduledPost.find({
      status: 'scheduled',
      scheduledTime: { $lte: now }
    }).maxTimeMS(5000); // Add timeout to prevent hanging

    const { postToSocialMedia } = require('../services/socialMediaService');

    for (const candidate of posts) {
      // Atomically CLAIM the post before publishing: flip status scheduled →
      // publishing in one operation. Only the claimer proceeds. This prevents a
      // slow platform call from letting the next minute's tick (or a parallel
      // worker) re-select the same row and DOUBLE-POST to the user's real
      // social account. Every downstream path resolves status to posted/failed.
      const post = await ScheduledPost.findOneAndUpdate(
        { _id: candidate._id, status: 'scheduled' },
        { $set: { status: 'publishing' } },
        { new: true }
      );
      if (!post) continue; // already claimed/processed by another tick
      try {
        // Check if user has connected the platform (SocialConnection or User.oauth for LinkedIn/Facebook)
        let hasConnection = false;
        const conn = await require('../models/SocialConnection').findOne({
          userId: post.userId,
          platform: post.platform,
          isActive: true
        });
        if (conn) {
          hasConnection = true;
        } else if (['linkedin', 'facebook'].includes(post.platform?.toLowerCase())) {
          // post.userId is a String — may be a Mongo ObjectId or a Supabase
          // UUID. Only do User.findById for ObjectIds; for UUIDs, read from
          // the unified OAuthStorage (social_links JSONB).
          const platformKey = post.platform.toLowerCase();
          let oauthRow = null;
          if (isMongoUserId(post.userId)) {
            const User = require('../models/User');
            const user = await User.findById(post.userId).select('oauth').lean();
            oauthRow = user?.oauth?.[platformKey] || null;
          } else {
            const OAuthStorage = require('../utils/oauthStorage');
            oauthRow = await OAuthStorage.loadTokens(String(post.userId), platformKey);
          }

          if (platformKey === 'facebook') {
            hasConnection = !!(oauthRow?.connected);
          } else if (platformKey === 'linkedin') {
            try {
              // Call via the singleton instance — destructuring would drop `this`.
              const linkedinService = require('../services/linkedinOAuthService');
              const status = await linkedinService.getConnectionStatus(post.userId?.toString());
              hasConnection = !!(status?.connected);
            } catch (_) {
              hasConnection = !!(oauthRow?.connected);
            }
          }
        }

        if (hasConnection) {
          // Post directly to platform
          try {
            // Multi-account: route through the user's chosen account id
            // (stored on the post). `postToSocialMedia` ultimately passes
            // this into the platform service so the right access token is
            // used. Falls back to the active/primary account inside the
            // service when null.
            const result = await postToSocialMedia(
              post.userId,
              post.platform,
              {
                text: post.content.text,
                mediaUrl: post.content.mediaUrl || '',
                hashtags: post.content.hashtags || [],
              },
              { accountId: post.accountId || null }
            );

            // Reject non-success results explicitly instead of treating
            // them as success — the previous code assigned undefined
            // to platformPostId which broke downstream analytics sync.
            if (result && result.success === false) {
              throw new Error(result.error || 'Platform rejected the post');
            }

            post.status = 'posted';
            post.platformPostId = result?.platformPostId
              || result?.id
              || result?._id?.toString()
              || `post-${Date.now()}`;
            // Guard against ObjectId values sneaking in — analytics sync
            // expects a string and skips anything that looks like a Mongo
            // id (24-hex).
            if (/^[a-f0-9]{24}$/i.test(String(post.platformPostId))) {
              logger.warn('platformPostId looks like ObjectId; analytics sync may skip', {
                postId: post._id, platformPostId: post.platformPostId,
              });
            }
            post.postedAt = new Date();
            const platformUrl = result?.url || result?.platformPostUrl || null;
            await post.save();

            logger.info('Post published', {
              postId: post._id,
              platform: post.platform,
              userId: post.userId
            });

            // Push live update + in-app success notification so any open
            // dashboard tab flips the post from `scheduled` to `published`
            // without the user refreshing.
            try {
              const { emitToUser } = require('../services/socketService');
              emitToUser(post.userId, 'post:status', {
                postId: String(post._id),
                platform: post.platform,
                status: 'published',
                url: platformUrl,
                postedAt: post.postedAt,
              });
              const notificationService = require('../services/notificationService');
              await notificationService.createNotification(
                post.userId,
                `${post.platform} post published`,
                platformUrl
                  ? `Your ${post.platform} post is live — ${platformUrl}`
                  : `Your ${post.platform} post has been published.`,
                'success',
                '/dashboard/posts',
                { category: 'publishing', priority: 'normal', context: { postId: String(post._id), platform: post.platform } }
              );
            } catch (notifyErr) {
              logger.warn('Could not emit post:published live update', { error: notifyErr.message });
            }
          } catch (postError) {
            logger.error('Error posting to platform', {
              postId: post._id,
              platform: post.platform,
              error: postError.message
            });
            post.status = 'failed';
            post.error = postError.message || `Failed to post to ${post.platform}.`;
            await post.save();
            try {
              const { emitToUser } = require('../services/socketService');
              emitToUser(post.userId, 'post:status', {
                postId: String(post._id),
                platform: post.platform,
                status: 'failed',
                error: post.error,
              });
            } catch { /* socket optional */ }
            await emitFailureNotification(post, post.error);
          }
        } else {
          // No active SocialConnection for this platform — fail the post
          // visibly instead of fake-succeeding with a mock platformPostId.
          // The previous behaviour ("posted" + mock id) was deceptive: the
          // analytics cron blacklists mock-* ids, so engagement never
          // arrived and the user thought their post worked. Now the post
          // shows up in the scheduler as `failed` with a clear reason and
          // a notification fires (see emitFailureNotification below).
          post.status = 'failed';
          post.error = `No active ${post.platform} connection. Reconnect at /dashboard/integrations.`;
          await post.save();

          logger.warn('Scheduled post failed: missing connection', {
            postId: post._id,
            platform: post.platform,
            userId: post.userId,
          });
          await emitFailureNotification(post, post.error);
        }
      } catch (error) {
        logger.error('Error publishing post', {
          postId: post._id,
          error: error.message
        });
        try {
          post.status = 'failed';
          post.error = error.message || 'Unexpected publishing error.';
          await post.save();
          await emitFailureNotification(post, post.error);
        } catch (saveError) {
          // If MongoDB is disconnected, can't save - that's okay
          logger.debug('Could not save failed post status', { error: saveError.message });
        }
      }
    }
  } catch (error) {
    // Handle MongoDB connection errors gracefully
    if (error.name === 'MongoServerError' || error.message?.includes('buffering timed out') || error.message?.includes('connection')) {
      // MongoDB connection issue - log but don't spam
      if (Date.now() % 60000 < 1000) { // Log roughly once per minute
        logger.debug('Scheduler cron skipped - MongoDB connection issue', {
          error: error.message,
          readyState: mongoose.connection.readyState
        });
      }
    } else {
      logger.error('Scheduler cron error', { error: error.message, stack: error.stack });
    }
  }
});

/**
 * @swagger
 * /api/scheduler/posts/{postId}:
 *   put:
 *     summary: Update scheduled post (reschedule)
 *     tags: [Scheduler]
 *     security:
 *       - bearerAuth: []
 */
router.put('/posts/:postId', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { scheduledTime, content, platform, status } = req.body;

  const post = await ScheduledPost.findOne({
    _id: postId,
    userId: req.user._id || req.user.id
  });

  if (!post) {
    return res.status(404).json({ success: false, error: 'Post not found' });
  }

  if (scheduledTime) {
    post.scheduledTime = new Date(scheduledTime);
  }
  if (content) {
    post.content = { ...post.content, ...content };
  }
  if (platform) {
    post.platform = platform;
  }
  if (status) {
    post.status = status;
  }

  await post.save();
  res.json({ success: true, message: 'Post updated successfully', data: post });
}));

module.exports = router;


const mongoose = require('mongoose');

const scheduledPostSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  // Typed as String so it accepts both Mongo ObjectIds (legacy) and the
  // UUIDs / clip ids produced by the Supabase-backed clips pipeline. Existing
  // ObjectId values still serialise cleanly through String.
  contentId: {
    type: String
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
    // Index defined below with schema.index()
  },
  platform: {
    type: String,
    enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads', 'snapchat', 'reddit'],
    required: true
  },
  // Multi-account: which connected account on the given platform this post
  // should publish from. Optional — when omitted, the worker picks the
  // user's active/primary account. Stored as String to accept platform-
  // specific ids (IG business id, page id, channel id, user id).
  accountId: {
    type: String,
    default: null,
    index: true,
  },
  // Last time the performance-learning cron drained this post's analytics
  // into the creator's UserStyleProfile. The cron picks up rows whose
  // `analytics.lastUpdated` is more recent than this timestamp.
  lastLearnedAt: {
    type: Date,
    default: null,
    index: true,
  },
  content: {
    text: String,
    mediaUrl: String,
    hashtags: [String],
    mentions: [String]
  },
  // Denormalised niche tag — copied from the parent Content at create
  // time (or from `user.niche` if no Content is attached). Lets the
  // `getTopPerformingPlaybook` query filter by niche without joining
  // through Content on every learning pass. Falls through to no-filter
  // for legacy rows that predate this field.
  niche: {
    type: String,
    default: null,
    index: true,
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  status: {
    type: String,
    // - scheduled: queued, holdUntil not yet passed
    // - pending: legacy, still accepted for in-flight rows pre-migration
    // - publishing: worker has picked it up and is calling the platform
    // - posted: success
    // - failed_retryable: transient (network/timeout/rate-limit) — retry later
    // - failed_permanent: auth/invalid_input/quota — no auto-retry, needs user
    // - failed: legacy umbrella, still accepted for older rows
    // - cancelled: user-cancelled inside the grace window
    enum: ['scheduled', 'pending', 'publishing', 'posted', 'failed', 'failed_retryable', 'failed_permanent', 'cancelled'],
    default: 'scheduled'
  },
  // Retry tracking — when status === 'failed_retryable' the worker bumps
  // attemptCount and reschedules via exponential backoff (1m, 5m, 25m, then
  // gives up by flipping to 'failed_permanent').
  attemptCount: {
    type: Number,
    default: 0,
  },
  nextRetryAt: {
    type: Date,
    default: null,
  },
  // Human-readable failure reason populated by the cron when status flips
  // to 'failed'. Surfaced to the scheduler UI + the in-app notification so
  // the user knows whether to reconnect, retry, or give up.
  error: {
    type: String,
    default: null,
  },
  // Safety hold: posts in `scheduled` state are NOT picked up by the cron
  // until `holdUntil` has passed. Lets users cancel within a configurable
  // grace window before anything irreversible hits a real platform.
  // Set to null when no hold is needed; defaults to scheduledTime - SAFETY
  // HOLD_MINUTES at create time.
  holdUntil: {
    type: Date,
    default: null,
    index: true,
  },
  // When true, the worker logs the publish intent but skips the real API
  // call. Lets users walk the entire flow against real OAuth tokens
  // without anything actually appearing on their public profile.
  // Server-wide default can also be set via DRY_RUN_PUBLISH=true env var.
  dryRun: {
    type: Boolean,
    default: false,
  },
  recurringScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecurringSchedule',
    default: null
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduleTemplate',
    default: null
  },
  conflictResolved: {
    type: Boolean,
    default: false
  },
  optimizationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  platformPostId: String,
  postedAt: {
    type: Date,
    index: true
  },
  lastAnalyticsSync: Date,
  analytics: {
    // Reach & Impressions
    impressions: {
      type: Number,
      default: 0
    },
    reach: {
      type: Number,
      default: 0
    },
    uniqueReach: {
      type: Number,
      default: 0
    },
    // Engagement Breakdown
    engagement: {
      type: Number,
      default: 0
    },
    engagementBreakdown: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      reactions: { type: Number, default: 0 }, // For LinkedIn/Facebook
      retweets: { type: Number, default: 0 }, // For Twitter
      views: { type: Number, default: 0 } // For video platforms
    },
    // Engagement Rates
    engagementRate: {
      byReach: {
        type: Number,
        default: 0 // (engagement / reach) * 100
      },
      byImpressions: {
        type: Number,
        default: 0 // (engagement / impressions) * 100
      },
      byFollowers: {
        type: Number,
        default: 0 // (engagement / followers) * 100
      }
    },
    // Additional Metrics
    clicks: {
      type: Number,
      default: 0
    },
    clickThroughRate: {
      type: Number,
      default: 0 // (clicks / impressions) * 100
    },
    videoViews: {
      type: Number,
      default: 0
    },
    videoCompletionRate: {
      type: Number,
      default: 0
    },
    // Follower Context (at time of post)
    followersAtPost: {
      type: Number,
      default: 0
    },
    // Timestamps
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    syncedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Optimized indexes for common queries
scheduledPostSchema.index({ userId: 1, scheduledTime: 1 });
scheduledPostSchema.index({ userId: 1, status: 1, scheduledTime: 1 }); // User's posts by status
scheduledPostSchema.index({ userId: 1, platform: 1, scheduledTime: 1 }); // User's posts by platform
scheduledPostSchema.index({ status: 1, scheduledTime: 1 }); // All posts by status (for cron jobs)
scheduledPostSchema.index({ platform: 1, status: 1 }); // Posts by platform and status
scheduledPostSchema.index({ contentId: 1 }); // Posts by content
scheduledPostSchema.index({ scheduledTime: 1, status: 1 }); // For scheduled post processing
scheduledPostSchema.index({ agencyWorkspaceId: 1, scheduledTime: 1 }); // Agency master calendar
scheduledPostSchema.index({ clientWorkspaceId: 1, scheduledTime: 1 }); // Client workspace calendar
scheduledPostSchema.index({ workspaceId: 1, scheduledTime: 1 }); // Workspace calendar
scheduledPostSchema.index({ campaignId: 1 }); // Campaign posts
scheduledPostSchema.index({ userId: 1, status: 1, postedAt: -1 }); // Optimal-time aggregation
scheduledPostSchema.index({ status: 1, lastAnalyticsSync: 1 }); // Resync queue
// Performance-learning cron query — picks posted rows that have synced
// analytics and either no `lastLearnedAt` yet OR analytics moved since
// the last learn pass. Without this index the 6h cron table-scans on
// large collections. The `_id` tail enables cursor pagination.
scheduledPostSchema.index({ status: 1, 'analytics.lastUpdated': 1, lastLearnedAt: 1, _id: 1 });
// Recurring-cron query — finds active templates whose nextFireAt has elapsed.
scheduledPostSchema.index({ userId: 1, platform: 1, postedAt: -1 }); // getTopPerformingPlaybook (recent posts per platform)

// Real-time update hooks
scheduledPostSchema.post('save', async function (doc) {
  try {
    const { handlePostCreated, handlePostUpdated } = require('../services/calendarRealtimeService');

    if (this.isNew) {
      await handlePostCreated(doc);

      // Create portal activity
      if (doc.clientWorkspaceId && doc.agencyWorkspaceId) {
        const { onPostScheduled } = require('../services/portalActivityHooks');
        await onPostScheduled(doc);
      }
    } else {
      await handlePostUpdated(doc, this.getChanges());

      // If status changed to posted, create activity
      if (doc.status === 'posted' && this.getChanges()?.status) {
        if (doc.clientWorkspaceId && doc.agencyWorkspaceId) {
          const { onPostPublished } = require('../services/portalActivityHooks');
          await onPostPublished(doc);
        }
      }
    }
  } catch (error) {
    // Don't throw - real-time updates are non-critical
    const logger = require('../utils/logger');
    logger.warn('Error in post save hook', { error: error.message });
  }
});

scheduledPostSchema.post('findOneAndDelete', async function (doc) {
  try {
    if (doc) {
      const { handlePostDeleted } = require('../services/calendarRealtimeService');
      await handlePostDeleted(doc._id, doc.agencyWorkspaceId);
    }
  } catch (error) {
    // Don't throw - real-time updates are non-critical
  }
});

module.exports = mongoose.model('ScheduledPost', scheduledPostSchema);


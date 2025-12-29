const mongoose = require('mongoose');

const scheduledPostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content'
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    index: true
  },
  platform: {
    type: String,
    enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads', 'snapchat', 'reddit'],
    required: true
  },
  content: {
    text: String,
    mediaUrl: String,
    hashtags: [String],
    mentions: [String]
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
    enum: ['scheduled', 'pending', 'posted', 'failed', 'cancelled'],
    default: 'scheduled'
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

// Real-time update hooks
scheduledPostSchema.post('save', async function(doc) {
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

scheduledPostSchema.post('findOneAndDelete', async function(doc) {
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


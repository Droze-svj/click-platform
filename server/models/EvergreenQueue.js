// Evergreen Queue Model
// Smart recycling queues per client with evergreen content

const mongoose = require('mongoose');

const evergreenQueueSchema = new mongoose.Schema({
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'all'],
    default: 'all'
  },
  contentItems: [{
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      required: true
    },
    scheduledPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledPost'
    },
    evergreenScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    lastUsed: Date,
    useCount: {
      type: Number,
      default: 0
    },
    nextScheduledDate: Date,
    status: {
      type: String,
      enum: ['active', 'paused', 'exhausted', 'archived'],
      default: 'active'
    },
    performance: {
      averageEngagement: Number,
      averageReach: Number,
      lastEngagement: Number,
      trend: {
        type: String,
        enum: ['increasing', 'stable', 'decreasing']
      }
    }
  }],
  settings: {
    autoSchedule: { type: Boolean, default: true },
    minEvergreenScore: { type: Number, default: 70 },
    maxUsesPerItem: { type: Number, default: 10 },
    rotationFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    postingFrequency: {
      type: String,
      enum: ['daily', 'every_other_day', 'weekly', 'biweekly'],
      default: 'weekly'
    },
    refreshThreshold: {
      type: Number,
      default: 0.2 // Refresh if engagement drops 20%
    }
  },
  stats: {
    totalItems: { type: Number, default: 0 },
    activeItems: { type: Number, default: 0 },
    totalPosts: { type: Number, default: 0 },
    averageEngagement: { type: Number, default: 0 },
    lastUpdated: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

evergreenQueueSchema.index({ clientWorkspaceId: 1, platform: 1 });
evergreenQueueSchema.index({ agencyWorkspaceId: 1, isActive: 1 });
evergreenQueueSchema.index({ 'contentItems.contentId': 1 });
evergreenQueueSchema.index({ 'contentItems.nextScheduledDate': 1 });

evergreenQueueSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.stats.totalItems = this.contentItems.length;
  this.stats.activeItems = this.contentItems.filter(item => item.status === 'active').length;
  this.stats.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('EvergreenQueue', evergreenQueueSchema);



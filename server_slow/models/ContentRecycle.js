// Content Recycling Model
// Tracks recycled/republished content

const mongoose = require('mongoose');

const contentRecycleSchema = new mongoose.Schema({
  originalContentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  originalPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
  },
  recycleType: {
    type: String,
    enum: ['exact', 'refreshed', 'variation'],
    default: 'exact'
  },
  originalPerformance: {
    engagement: Number,
    views: Number,
    clicks: Number,
    impressions: Number,
    engagementRate: Number,
    postedAt: Date
  },
  repostPerformance: {
    engagement: Number,
    views: Number,
    clicks: Number,
    impressions: Number,
    engagementRate: Number,
    postedAt: Date
  },
  repostSchedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'custom'],
      default: 'monthly'
    },
    interval: {
      type: Number, // days
      default: 30
    },
    maxReposts: {
      type: Number,
      default: 5
    },
    currentRepostCount: {
      type: Number,
      default: 0
    },
    nextRepostDate: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  refreshOptions: {
    updateHashtags: {
      type: Boolean,
      default: true
    },
    updateCaption: {
      type: Boolean,
      default: false
    },
    updateTiming: {
      type: Boolean,
      default: true
    },
    addNewElements: {
      type: Boolean,
      default: false
    },
    generateVariations: {
      type: Boolean,
      default: false
    },
    variationCount: {
      type: Number,
      default: 3
    },
    abTesting: {
      type: Boolean,
      default: false
    }
  },
  reposts: [{
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledPost'
    },
    scheduledTime: Date,
    postedAt: Date,
    performance: {
      engagement: Number,
      views: Number,
      clicks: Number,
      impressions: Number,
      engagementRate: Number
    },
    refreshChanges: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  isEvergreen: {
    type: Boolean,
    default: false
  },
  evergreenScore: {
    type: Number,
    default: 0
  },
  performanceTrend: {
    type: String,
    enum: ['improving', 'stable', 'declining', 'unknown'],
    default: 'unknown'
  },
  decayDetected: {
    type: Boolean,
    default: false
  },
  autoAdjustment: {
    enabled: {
      type: Boolean,
      default: false
    },
    minPerformanceThreshold: {
      type: Number,
      default: 0.8 // 80% of original performance
    },
    adjustmentStrategy: {
      type: String,
      enum: ['frequency', 'refresh', 'pause'],
      default: 'frequency'
    }
  },
  recyclingTemplate: {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecyclingTemplate',
      default: null
    },
    templateName: {
      type: String,
      default: null
    }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active'
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

// Indexes
contentRecycleSchema.index({ userId: 1, status: 1 });
contentRecycleSchema.index({ originalContentId: 1 });
contentRecycleSchema.index({ 'repostSchedule.nextRepostDate': 1 });
contentRecycleSchema.index({ isEvergreen: 1, evergreenScore: -1 });
contentRecycleSchema.index({ platform: 1, status: 1 });

// Update updatedAt on save
contentRecycleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for performance comparison
contentRecycleSchema.virtual('performanceChange').get(function() {
  if (!this.originalPerformance?.engagement || !this.repostPerformance?.engagement) {
    return 0;
  }
  return ((this.repostPerformance.engagement - this.originalPerformance.engagement) / this.originalPerformance.engagement) * 100;
});

module.exports = mongoose.model('ContentRecycle', contentRecycleSchema);


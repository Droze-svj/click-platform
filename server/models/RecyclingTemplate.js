// Recycling Template Model
// Reusable recycling configurations

const mongoose = require('mongoose');

const recyclingTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  repostSchedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'custom'],
      default: 'monthly'
    },
    interval: {
      type: Number,
      default: 30
    },
    maxReposts: {
      type: Number,
      default: 5
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
  autoAdjustment: {
    enabled: {
      type: Boolean,
      default: false
    },
    minPerformanceThreshold: {
      type: Number,
      default: 0.8
    },
    adjustmentStrategy: {
      type: String,
      enum: ['frequency', 'refresh', 'pause'],
      default: 'frequency'
    }
  },
  filters: {
    minEngagement: {
      type: Number,
      default: 100
    },
    minEngagementRate: {
      type: Number,
      default: 2.0
    },
    platforms: [{
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
    }]
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
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
recyclingTemplateSchema.index({ userId: 1, isDefault: 1 });
recyclingTemplateSchema.index({ teamId: 1 });

recyclingTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('RecyclingTemplate', recyclingTemplateSchema);



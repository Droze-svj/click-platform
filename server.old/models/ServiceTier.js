// Service Tier Model
// Bronze/Silver/Gold service packages

const mongoose = require('mongoose');

const serviceTierSchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    enum: ['bronze', 'silver', 'gold', 'custom'],
    index: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  pricing: {
    monthly: {
      type: Number,
      default: 0
    },
    annual: {
      type: Number,
      default: 0
    }
  },
  features: {
    postsPerWeek: {
      type: Number,
      default: 0
    },
    platforms: [{
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
    }],
    platformsCount: {
      type: Number,
      default: 0
    },
    reportTypes: [{
      type: String,
      enum: ['basic', 'standard', 'advanced', 'custom']
    }],
    reportFrequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'quarterly'],
      default: 'monthly'
    },
    contentTypes: [{
      type: String,
      enum: ['post', 'video', 'carousel', 'story', 'reel', 'article']
    }],
    aiFeatures: {
      contentGeneration: { type: Boolean, default: false },
      hashtagGeneration: { type: Boolean, default: false },
      optimalTiming: { type: Boolean, default: false },
      performancePrediction: { type: Boolean, default: false },
      contentRecycling: { type: Boolean, default: false }
    },
    support: {
      type: String,
      enum: ['email', 'priority_email', 'chat', 'dedicated'],
      default: 'email'
    },
    revisions: {
      type: Number,
      default: 0 // 0 = unlimited
    },
    approvalWorkflows: {
      type: Number,
      default: 1
    },
    teamMembers: {
      type: Number,
      default: 1
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    }
  },
  limits: {
    storage: {
      type: Number,
      default: 0 // GB, 0 = unlimited
    },
    contentLibrary: {
      type: Number,
      default: 0 // items, 0 = unlimited
    },
    scheduledPosts: {
      type: Number,
      default: 0 // 0 = unlimited
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  order: {
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

serviceTierSchema.index({ agencyWorkspaceId: 1, name: 1 });
serviceTierSchema.index({ agencyWorkspaceId: 1, isActive: 1, order: 1 });

serviceTierSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.features.platformsCount = this.features.platforms.length;
  next();
});

module.exports = mongoose.model('ServiceTier', serviceTierSchema);



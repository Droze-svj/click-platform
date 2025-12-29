// Playbook Model
// Cross-client templates and playbooks for agencies

const mongoose = require('mongoose');

const playbookSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: [
      'podcast_repurposing',
      'product_launch',
      'content_series',
      'event_promotion',
      'seasonal_campaign',
      'evergreen_content',
      'user_generated_content',
      'influencer_collaboration',
      'other'
    ],
    default: 'other'
  },
  // Playbook structure
  structure: {
    steps: [{
      stepNumber: Number,
      name: String,
      description: String,
      type: {
        type: String,
        enum: ['content_creation', 'scheduling', 'approval', 'publishing', 'analysis']
      },
      required: { type: Boolean, default: false },
      estimatedTime: Number, // minutes
      dependencies: [Number] // step numbers this depends on
    }],
    estimatedTotalTime: Number, // minutes
    deliverables: [String]
  },
  // Content templates
  contentTemplates: [{
    name: String,
    platform: String,
    format: {
      type: String,
      enum: ['post', 'story', 'reel', 'video', 'carousel', 'article']
    },
    template: {
      caption: String,
      hashtags: [String],
      media: {
        type: String,
        enum: ['image', 'video', 'carousel', 'none']
      },
      cta: String
    },
    aiPrompt: String, // AI prompt for generating this content
    order: Number // Order in playbook
  }],
  // Scheduling rules
  scheduling: {
    frequency: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly', 'custom']
    },
    duration: Number, // days
    platforms: [String],
    optimalTimes: mongoose.Schema.Types.Mixed, // Platform-specific optimal times
    spacing: Number // hours between posts
  },
  // Approval workflow
  approval: {
    required: { type: Boolean, default: true },
    workflow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow'
    },
    autoApprove: { type: Boolean, default: false }
  },
  // Success criteria
  successCriteria: {
    targetEngagement: Number,
    targetReach: Number,
    targetConversions: Number,
    kpis: [String]
  },
  // Usage stats
  stats: {
    timesUsed: { type: Number, default: 0 },
    clientsUsed: { type: Number, default: 0 },
    averagePerformance: {
      engagement: Number,
      reach: Number,
      conversions: Number
    },
    successRate: { type: Number, default: 0 } // percentage
  },
  // Sharing
  sharing: {
    isPublic: { type: Boolean, default: false },
    sharedWith: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      permission: {
        type: String,
        enum: ['view', 'use', 'edit'],
        default: 'use'
      }
    }]
  },
  // Tags
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
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

playbookSchema.index({ userId: 1, category: 1, isActive: 1 });
playbookSchema.index({ 'sharing.isPublic': 1, isActive: 1 });
playbookSchema.index({ tags: 1 });

playbookSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Playbook', playbookSchema);



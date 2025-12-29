// Always-On Library Model
// Topic playlists that drip posts where performance stays above threshold

const mongoose = require('mongoose');

const alwaysOnLibrarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
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
  topic: {
    type: String,
    required: true,
    index: true
  },
  tags: [String],
  platforms: [{
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
  }],
  content: [{
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    performance: {
      avgEngagement: { type: Number, default: 0 },
      avgEngagementRate: { type: Number, default: 0 },
      postCount: { type: Number, default: 0 },
      lastPosted: Date
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'removed'],
      default: 'active'
    }
  }],
  settings: {
    performanceThreshold: {
      minEngagement: { type: Number, default: 100 },
      minEngagementRate: { type: Number, default: 0.05 },
      autoPause: { type: Boolean, default: true }
    },
    dripSchedule: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'biweekly', 'monthly'],
        default: 'weekly'
      },
      daysOfWeek: [Number], // 0 = Sunday, 6 = Saturday
      times: [String], // HH:MM format
      timezone: { type: String, default: 'UTC' }
    },
    rotation: {
      type: {
        type: String,
        enum: ['sequential', 'random', 'performance_based'],
        default: 'performance_based'
      },
      minDaysBetween: { type: Number, default: 30 }
    },
    limits: {
      maxPostsPerDay: { type: Number, default: 3 },
      maxPostsPerWeek: { type: Number, default: 10 }
    }
  },
  performance: {
    totalPosts: { type: Number, default: 0 },
    totalEngagement: { type: Number, default: 0 },
    avgEngagement: { type: Number, default: 0 },
    activeContent: { type: Number, default: 0 },
    pausedContent: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'archived'],
    default: 'active',
    index: true
  },
  lastPosted: Date,
  nextPost: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

alwaysOnLibrarySchema.index({ userId: 1, status: 1, topic: 1 });
alwaysOnLibrarySchema.index({ 'settings.dripSchedule.nextPost': 1 });

alwaysOnLibrarySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to get next content to post
alwaysOnLibrarySchema.methods.getNextContent = function() {
  const activeContent = this.content.filter(c => c.status === 'active');
  
  if (activeContent.length === 0) {
    return null;
  }

  switch (this.settings.rotation.type) {
    case 'sequential':
      // Get content that hasn't been posted recently
      const sorted = activeContent.sort((a, b) => 
        (a.performance.lastPosted || new Date(0)) - (b.performance.lastPosted || new Date(0))
      );
      return sorted[0];
    
    case 'random':
      return activeContent[Math.floor(Math.random() * activeContent.length)];
    
    case 'performance_based':
      // Sort by performance, but respect minDaysBetween
      const now = new Date();
      const eligible = activeContent.filter(c => {
        const lastPosted = c.performance.lastPosted || new Date(0);
        const daysSince = (now - lastPosted) / (1000 * 60 * 60 * 24);
        return daysSince >= this.settings.rotation.minDaysBetween;
      });

      if (eligible.length === 0) {
        // If all content was posted recently, use oldest
        return activeContent.sort((a, b) => 
          (a.performance.lastPosted || new Date(0)) - (b.performance.lastPosted || new Date(0))
        )[0];
      }

      // Sort by performance
      return eligible.sort((a, b) => 
        (b.performance.avgEngagement || 0) - (a.performance.avgEngagement || 0)
      )[0];
    
    default:
      return activeContent[0];
  }
};

module.exports = mongoose.model('AlwaysOnLibrary', alwaysOnLibrarySchema);



// Posting Cadence Model
// Track posting frequency and content mix

const mongoose = require('mongoose');

const postingCadenceSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    required: true,
    index: true
  },
  // Period
  period: {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true }
  },
  // Posting Frequency
  frequency: {
    totalPosts: { type: Number, default: 0 },
    postsPerDay: { type: Number, default: 0 },
    postsPerWeek: { type: Number, default: 0 },
    averageDaysBetween: { type: Number, default: 0 },
    consistency: { type: Number, default: 0 } // 0-100
  },
  // Content Mix
  contentMix: {
    formats: [{
      format: String,
      count: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 }
    }],
    types: [{
      type: String,
      count: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 }
    }],
    topics: [{
      topic: String,
      count: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 }
    }]
  },
  // Performance Correlation
  correlation: {
    frequencyToEngagement: { type: Number, default: 0 }, // -1 to 1
    frequencyToClicks: { type: Number, default: 0 },
    frequencyToConversions: { type: Number, default: 0 },
    mixToPerformance: {
      bestFormat: String,
      bestType: String,
      bestTopic: String,
      correlationScore: { type: Number, default: 0 }
    }
  },
  // Optimal Cadence
  optimal: {
    recommendedPostsPerWeek: { type: Number, default: 0 },
    recommendedMix: {
      formats: [{
        format: String,
        percentage: Number
      }],
      types: [{
        type: String,
        percentage: Number
      }]
    },
    bestPostingDays: [String],
    bestPostingTimes: [Number] // Hours
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

postingCadenceSchema.index({ workspaceId: 1, platform: 1, 'period.startDate': -1 });
postingCadenceSchema.index({ workspaceId: 1, 'period.startDate': -1 });

postingCadenceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PostingCadence', postingCadenceSchema);



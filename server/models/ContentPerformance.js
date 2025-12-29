// Content Performance Model
// Track content-level performance insights

const mongoose = require('mongoose');

const contentPerformanceSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true,
    unique: true,
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    index: true
  },
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
  // Content Classification
  content: {
    format: {
      type: String,
      enum: ['video', 'image', 'carousel', 'text', 'link', 'story', 'reel'],
      index: true
    },
    type: {
      type: String,
      enum: ['short_form', 'long_form', 'article', 'podcast', 'transcript'],
      index: true
    },
    topics: [{
      type: String,
      index: true
    }],
    category: String,
    hashtags: [String]
  },
  // Performance Metrics
  performance: {
    engagement: { type: Number, default: 0, index: true },
    clicks: { type: Number, default: 0, index: true },
    conversions: { type: Number, default: 0, index: true },
    revenue: { type: Number, default: 0, index: true },
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 }
  },
  // Performance Scores
  scores: {
    engagement: { type: Number, default: 0 }, // 0-100
    clickThrough: { type: Number, default: 0 }, // 0-100
    conversion: { type: Number, default: 0 }, // 0-100
    overall: { type: Number, default: 0, index: true } // 0-100
  },
  // Rankings
  rankings: {
    byEngagement: { type: Number, default: null },
    byClicks: { type: Number, default: null },
    byConversions: { type: Number, default: null },
    byRevenue: { type: Number, default: null },
    overall: { type: Number, default: null }
  },
  // Performance Category
  category: {
    type: String,
    enum: ['top_performer', 'high_performer', 'average', 'below_average', 'low_performer'],
    default: 'average',
    index: true
  },
  postedAt: {
    type: Date,
    required: true,
    index: true
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

contentPerformanceSchema.index({ workspaceId: 1, 'scores.overall': -1 });
contentPerformanceSchema.index({ workspaceId: 1, platform: 1, 'scores.overall': -1 });
contentPerformanceSchema.index({ 'content.format': 1, 'content.type': 1, 'scores.overall': -1 });
contentPerformanceSchema.index({ 'content.topics': 1, 'scores.overall': -1 });
contentPerformanceSchema.index({ postedAt: 1 });

contentPerformanceSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Calculate performance category
  if (this.scores.overall >= 80) {
    this.category = 'top_performer';
  } else if (this.scores.overall >= 60) {
    this.category = 'high_performer';
  } else if (this.scores.overall >= 40) {
    this.category = 'average';
  } else if (this.scores.overall >= 20) {
    this.category = 'below_average';
  } else {
    this.category = 'low_performer';
  }

  next();
});

module.exports = mongoose.model('ContentPerformance', contentPerformanceSchema);



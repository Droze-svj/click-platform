// Content Recommendation Model
// AI-powered content recommendations

const mongoose = require('mongoose');

const contentRecommendationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    index: true
  },
  // Recommendation Type
  type: {
    type: String,
    enum: ['format', 'topic', 'timing', 'mix', 'repurpose', 'gap_fill'],
    required: true,
    index: true
  },
  // Recommendation Details
  recommendation: {
    title: { type: String, required: true },
    description: String,
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    confidence: { type: Number, default: 0 }, // 0-100
    expectedImpact: {
      engagement: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 }
    }
  },
  // Data Supporting Recommendation
  data: {
    topPerformers: [{
      postId: mongoose.Schema.Types.ObjectId,
      metric: String,
      value: Number
    }],
    benchmarks: mongoose.Schema.Types.Mixed,
    trends: mongoose.Schema.Types.Mixed
  },
  // Action Items
  actions: [{
    action: String,
    description: String,
    priority: String
  }],
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'dismissed'],
    default: 'pending',
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

contentRecommendationSchema.index({ workspaceId: 1, status: 1, type: 1 });
contentRecommendationSchema.index({ workspaceId: 1, 'recommendation.priority': 1 });

contentRecommendationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ContentRecommendation', contentRecommendationSchema);



// Growth Attribution Model
// Track what content drives follower growth

const mongoose = require('mongoose');

const growthAttributionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    required: true,
    index: true
  },
  period: {
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  growth: {
    newFollowers: { type: Number, default: 0 },
    attributedToContent: { type: Number, default: 0 },
    attributedToEngagement: { type: Number, default: 0 },
    organic: { type: Number, default: 0 }
  },
  topContent: [{
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledPost'
    },
    attributedGrowth: { type: Number, default: 0 },
    correlationScore: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    reach: { type: Number, default: 0 }
  }],
  contentTypes: [{
    contentType: String,
    attributedGrowth: { type: Number, default: 0 },
    posts: { type: Number, default: 0 }
  }],
  topics: [{
    topic: String,
    attributedGrowth: { type: Number, default: 0 },
    posts: { type: Number, default: 0 }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

growthAttributionSchema.index({ userId: 1, platform: 1, 'period.startDate': -1 });

module.exports = mongoose.model('GrowthAttribution', growthAttributionSchema);



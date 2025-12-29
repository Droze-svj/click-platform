// Engagement Quality Model
// Quality scoring for engagement

const mongoose = require('mongoose');

const engagementQualitySchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true,
    unique: true,
    index: true
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
    index: true
  },
  factors: {
    engagementDepth: {
      type: Number,
      default: 0 // Comments and shares weighted higher
    },
    engagementVelocity: {
      type: Number,
      default: 0 // How quickly engagement happened
    },
    engagementDiversity: {
      type: Number,
      default: 0 // Variety of engagement types
    },
    audienceQuality: {
      type: Number,
      default: 0 // Engagement from high-quality accounts
    },
    sentiment: {
      type: Number,
      default: 0 // Positive sentiment score
    }
  },
  sentimentAnalysis: {
    positive: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    negative: { type: Number, default: 0 },
    overall: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral'
    }
  },
  topEngagers: [{
    userId: String,
    username: String,
    engagementType: String,
    influenceScore: Number
  }],
  analyzedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

engagementQualitySchema.index({ postId: 1 });
engagementQualitySchema.index({ qualityScore: -1 });

module.exports = mongoose.model('EngagementQuality', engagementQualitySchema);



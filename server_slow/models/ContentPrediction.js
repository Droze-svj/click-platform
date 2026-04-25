// Content Prediction Model
// Predict content performance before posting

const mongoose = require('mongoose');

const contentPredictionSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
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
  // Predictions
  predictions: {
    engagement: {
      predicted: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 }, // 0-100
      range: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      }
    },
    clicks: {
      predicted: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      range: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      }
    },
    conversions: {
      predicted: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      range: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      }
    },
    revenue: {
      predicted: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      range: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      }
    },
    overall: {
      predicted: { type: Number, default: 0 }, // 0-100
      confidence: { type: Number, default: 0 },
      category: {
        type: String,
        enum: ['top_performer', 'high_performer', 'average', 'below_average', 'low_performer']
      }
    }
  },
  // Factors
  factors: {
    contentQuality: { type: Number, default: 0 },
    timing: { type: Number, default: 0 },
    format: { type: Number, default: 0 },
    topic: { type: Number, default: 0 },
    historicalPerformance: { type: Number, default: 0 }
  },
  // Actual Performance (updated after posting)
  actual: {
    engagement: { type: Number, default: null },
    clicks: { type: Number, default: null },
    conversions: { type: Number, default: null },
    revenue: { type: Number, default: null },
    accuracy: { type: Number, default: null } // Prediction accuracy percentage
  },
  predictedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

contentPredictionSchema.index({ workspaceId: 1, predictedAt: -1 });
contentPredictionSchema.index({ platform: 1, 'predictions.overall.predicted': -1 });

module.exports = mongoose.model('ContentPrediction', contentPredictionSchema);



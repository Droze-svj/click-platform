// Model Learning Schema
// Tracks AI model performance and usage for continuous learning

const mongoose = require('mongoose');

const modelLearningSchema = new mongoose.Schema({
  // User context
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Indexed in compound index below: { userId: 1, createdAt: -1 }
  },

  // Model identification
  provider: {
    type: String,
    required: true,
    enum: ['openrouter', 'huggingface', 'cerebras', 'replicate', 'openai'],
    index: true,
  },
  model: {
    type: String,
    required: true,
    index: true,
  },
  taskType: {
    type: String,
    required: true,
    enum: [
      'content-generation',
      'caption-generation',
      'hashtag-generation',
      'content-optimization',
      'translation',
      'summarization',
      'other',
    ],
    index: true,
  },

  // Usage metrics
  promptLength: {
    type: Number,
    default: 0,
  },
  responseLength: {
    type: Number,
    default: 0,
  },
  responseTime: {
    type: Number, // milliseconds
    default: 0,
  },
  tokensUsed: {
    type: Number,
    default: 0,
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5,
  },

  // Aggregated metrics (for aggregated records)
  aggregated: {
    type: Boolean,
    default: false,
    index: true,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  totalResponseTime: {
    type: Number,
    default: 0,
  },
  totalTokens: {
    type: Number,
    default: 0,
  },
  totalQualityScore: {
    type: Number,
    default: 0,
  },
  avgQualityScore: {
    type: Number,
    default: 0,
  },
  avgResponseTime: {
    type: Number,
    default: 0,
  },
  avgTokens: {
    type: Number,
    default: 0,
  },
  lastUsed: {
    type: Date,
    default: Date.now,
    index: true,
  },

  // Metadata
  metadata: {
    timestamp: Date,
    userAgent: String,
    platform: String,
    error: String,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
modelLearningSchema.index({ provider: 1, model: 1, taskType: 1 });
modelLearningSchema.index({ aggregated: 1, taskType: 1, avgQualityScore: -1 });
modelLearningSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ModelLearning', modelLearningSchema);



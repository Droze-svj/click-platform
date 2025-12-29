// Benchmark History Model
// Track benchmark performance over time

const mongoose = require('mongoose');

const benchmarkHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    default: null
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    required: true
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'weekly'
  },
  metrics: {
    engagement: Number,
    engagementRate: Number,
    impressions: Number
  },
  percentiles: {
    engagement: Number,
    engagementRate: Number,
    impressions: Number
  },
  overallScore: {
    score: Number,
    grade: String
  },
  comparedToIndustry: {
    engagement: { value: Number, benchmark: Number, difference: Number, percentage: Number },
    engagementRate: { value: Number, benchmark: Number, difference: Number, percentage: Number }
  },
  recordedAt: {
    type: Date,
    default: Date.now
  }
});

benchmarkHistorySchema.index({ userId: 1, recordedAt: -1 });
benchmarkHistorySchema.index({ contentId: 1, recordedAt: -1 });
benchmarkHistorySchema.index({ platform: 1, recordedAt: -1 });
benchmarkHistorySchema.index({ recordedAt: -1 });

// Auto-delete old history (older than 2 years)
benchmarkHistorySchema.index({ recordedAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

module.exports = mongoose.model('BenchmarkHistory', benchmarkHistorySchema);



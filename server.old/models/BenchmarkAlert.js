// Benchmark Alert Model
// Alerts when performance drops below benchmarks

const mongoose = require('mongoose');

const benchmarkAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  benchmarkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomBenchmark',
    default: null
  },
  useIndustryBenchmark: {
    type: Boolean,
    default: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'all'],
    required: true
  },
  metric: {
    type: String,
    enum: ['engagement', 'engagementRate', 'impressions'],
    required: true
  },
  threshold: {
    type: String,
    enum: ['below_p25', 'below_p50', 'below_custom'],
    required: true
  },
  customThreshold: {
    type: Number,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastTriggered: {
    type: Date,
    default: null
  },
  triggerCount: {
    type: Number,
    default: 0
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

benchmarkAlertSchema.index({ userId: 1, isActive: 1 });
benchmarkAlertSchema.index({ platform: 1, metric: 1 });

benchmarkAlertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('BenchmarkAlert', benchmarkAlertSchema);



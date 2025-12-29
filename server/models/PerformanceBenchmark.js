// Performance Benchmark Model
// Industry benchmarks and comparisons

const mongoose = require('mongoose');

const performanceBenchmarkSchema = new mongoose.Schema({
  industry: {
    type: String,
    required: true,
    index: true
  },
  niche: {
    type: String,
    index: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    required: true,
    index: true
  },
  metrics: {
    averageEngagementRate: {
      byReach: { type: Number, default: 0 },
      byImpressions: { type: Number, default: 0 },
      byFollowers: { type: Number, default: 0 }
    },
    averageReach: { type: Number, default: 0 },
    averageImpressions: { type: Number, default: 0 },
    averageGrowthRate: { type: Number, default: 0 },
    averageChurnRate: { type: Number, default: 0 },
    averagePostingFrequency: { type: Number, default: 0 } // posts per week
  },
  percentiles: {
    p25: {
      engagementRate: { type: Number, default: 0 },
      growthRate: { type: Number, default: 0 }
    },
    p50: {
      engagementRate: { type: Number, default: 0 },
      growthRate: { type: Number, default: 0 }
    },
    p75: {
      engagementRate: { type: Number, default: 0 },
      growthRate: { type: Number, default: 0 }
    },
    p90: {
      engagementRate: { type: Number, default: 0 },
      growthRate: { type: Number, default: 0 }
    }
  },
  sampleSize: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

performanceBenchmarkSchema.index({ industry: 1, platform: 1 });
performanceBenchmarkSchema.index({ niche: 1, platform: 1 });

module.exports = mongoose.model('PerformanceBenchmark', performanceBenchmarkSchema);



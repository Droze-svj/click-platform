// Competitor Benchmark Model
// Track competitor comparisons

const mongoose = require('mongoose');

const competitorBenchmarkSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
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
      enum: ['weekly', 'monthly', 'quarterly'],
      required: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true }
  },
  // Competitors
  competitors: [{
    name: { type: String, required: true },
    handle: String,
    metrics: {
      followers: { type: Number, default: 0 },
      engagement: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
      posts: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 }
    }
  }],
  // Our Metrics
  ourMetrics: {
    followers: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    posts: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 }
  },
  // Comparison
  comparison: {
    followersRank: { type: Number, default: null }, // 1 = best
    engagementRank: { type: Number, default: null },
    reachRank: { type: Number, default: null },
    engagementRateRank: { type: Number, default: null },
    averageRank: { type: Number, default: null },
    percentile: { type: Number, default: 0 } // 0-100
  },
  // Industry Benchmark
  industryBenchmark: {
    averageEngagementRate: { type: Number, default: 0 },
    averageReach: { type: Number, default: 0 },
    averageFollowers: { type: Number, default: 0 },
    ourVsIndustry: {
      engagementRate: { type: Number, default: 0 }, // Percentage difference
      reach: { type: Number, default: 0 },
      followers: { type: Number, default: 0 }
    }
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

competitorBenchmarkSchema.index({ workspaceId: 1, platform: 1, 'period.startDate': -1 });
competitorBenchmarkSchema.index({ clientWorkspaceId: 1, 'period.startDate': -1 });

competitorBenchmarkSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Calculate ranks
  if (this.competitors.length > 0) {
    const allMetrics = [
      { name: 'us', followers: this.ourMetrics.followers, engagement: this.ourMetrics.engagement, reach: this.ourMetrics.reach, engagementRate: this.ourMetrics.engagementRate }
    ];

    this.competitors.forEach(comp => {
      allMetrics.push({
        name: comp.name,
        followers: comp.metrics.followers,
        engagement: comp.metrics.engagement,
        reach: comp.metrics.reach,
        engagementRate: comp.metrics.engagementRate
      });
    });

    // Calculate ranks (1 = best)
    this.comparison.followersRank = calculateRank(allMetrics, 'followers', 'us') + 1;
    this.comparison.engagementRank = calculateRank(allMetrics, 'engagement', 'us') + 1;
    this.comparison.reachRank = calculateRank(allMetrics, 'reach', 'us') + 1;
    this.comparison.engagementRateRank = calculateRank(allMetrics, 'engagementRate', 'us') + 1;

    // Average rank
    const ranks = [
      this.comparison.followersRank,
      this.comparison.engagementRank,
      this.comparison.reachRank,
      this.comparison.engagementRateRank
    ].filter(r => r !== null);

    this.comparison.averageRank = ranks.length > 0
      ? ranks.reduce((sum, r) => sum + r, 0) / ranks.length
      : null;

    // Percentile (lower rank = higher percentile)
    const total = allMetrics.length;
    this.comparison.percentile = this.comparison.averageRank
      ? Math.round(((total - this.comparison.averageRank) / total) * 100)
      : 0;
  }

  next();
});

function calculateRank(metrics, field, targetName) {
  const sorted = [...metrics].sort((a, b) => b[field] - a[field]);
  return sorted.findIndex(m => m.name === targetName);
}

module.exports = mongoose.model('CompetitorBenchmark', competitorBenchmarkSchema);



// Multi-Client Rollup Model
// Aggregated view across all agency clients

const mongoose = require('mongoose');

const clientSummarySchema = new mongoose.Schema({
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  clientName: String,
  // Performance metrics
  performance: {
    totalReach: Number,
    totalImpressions: Number,
    totalEngagement: Number,
    engagementRate: Number,
    totalClicks: Number,
    ctr: Number,
    totalConversions: Number,
    conversionRate: Number,
    totalRevenue: Number,
    totalCost: Number,
    roi: Number,
    roas: Number
  },
  // Health score
  healthScore: {
    overall: { type: Number, min: 0, max: 100 },
    awareness: { type: Number, min: 0, max: 100 },
    engagement: { type: Number, min: 0, max: 100 },
    growth: { type: Number, min: 0, max: 100 },
    sentiment: { type: Number, min: 0, max: 100 },
    trend: {
      type: String,
      enum: ['improving', 'stable', 'declining']
    }
  },
  // Risk flags
  riskFlags: [{
    type: {
      type: String,
      enum: [
        'low_engagement',
        'declining_growth',
        'negative_sentiment',
        'high_churn',
        'low_health_score',
        'sla_overdue',
        'approval_bottleneck',
        'content_gap'
      ]
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    message: String,
    detectedAt: { type: Date, default: Date.now }
  }],
  // Benchmarks
  benchmarks: {
    engagementRate: {
      value: Number,
      industryAverage: Number,
      percentile: Number
    },
    ctr: {
      value: Number,
      industryAverage: Number,
      percentile: Number
    },
    roi: {
      value: Number,
      industryAverage: Number,
      percentile: Number
    }
  },
  // Period
  period: {
    startDate: Date,
    endDate: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const multiClientRollupSchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true
    // unique: true already creates an index, and it's also in compound index below
  },
  // Period
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  // Client summaries
  clients: [clientSummarySchema],
  // Aggregated totals
  totals: {
    totalReach: Number,
    totalImpressions: Number,
    totalEngagement: Number,
    averageEngagementRate: Number,
    totalClicks: Number,
    averageCtr: Number,
    totalConversions: Number,
    averageConversionRate: Number,
    totalRevenue: Number,
    totalCost: Number,
    averageRoi: Number,
    averageRoas: Number,
    averageHealthScore: Number
  },
  // Risk summary
  riskSummary: {
    totalClients: Number,
    clientsAtRisk: Number,
    criticalRisks: Number,
    highRisks: Number,
    mediumRisks: Number,
    lowRisks: Number
  },
  // Top performers
  topPerformers: {
    byEngagement: [{
      clientWorkspaceId: mongoose.Schema.Types.ObjectId,
      clientName: String,
      value: Number
    }],
    byGrowth: [{
      clientWorkspaceId: mongoose.Schema.Types.ObjectId,
      clientName: String,
      value: Number
    }],
    byRoi: [{
      clientWorkspaceId: mongoose.Schema.Types.ObjectId,
      clientName: String,
      value: Number
    }]
  },
  // Generated at
  generatedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

multiClientRollupSchema.index({ agencyWorkspaceId: 1, 'period.startDate': -1, 'period.endDate': -1 });

multiClientRollupSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('MultiClientRollup', multiClientRollupSchema);



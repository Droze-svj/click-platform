// Client Health Score Model
// Overall client health score and trends

const mongoose = require('mongoose');

const clientHealthScoreSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
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
  // Health Components
  components: {
    awareness: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 0.25 }
    },
    engagement: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 0.25 }
    },
    growth: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 0.20 }
    },
    quality: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 0.15 }
    },
    sentiment: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 0.15 }
    }
  },
  // Overall Health Score
  healthScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  // Health Status
  status: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'needs_attention', 'critical'],
    default: 'fair'
    // Index defined below with schema.index()
  },
  // Trends
  trends: {
    scoreChange: { type: Number, default: 0 }, // Percentage change
    direction: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    momentum: { type: Number, default: 0 } // -1 to 1
  },
  // Comparison
  comparison: {
    previousPeriod: {
      score: { type: Number, default: 0 },
      change: { type: Number, default: 0 }
    },
    industryAverage: {
      score: { type: Number, default: 0 },
      difference: { type: Number, default: 0 }
    },
    percentile: { type: Number, default: 0 } // 0-100
  },
  // Key Insights
  insights: [{
    type: {
      type: String,
      enum: ['strength', 'weakness', 'opportunity', 'threat']
    },
    category: String,
    message: String,
    impact: {
      type: String,
      enum: ['high', 'medium', 'low']
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

clientHealthScoreSchema.index({ clientWorkspaceId: 1, 'period.startDate': -1 });
clientHealthScoreSchema.index({ agencyWorkspaceId: 1, 'period.startDate': -1 });
clientHealthScoreSchema.index({ healthScore: -1 });
clientHealthScoreSchema.index({ status: 1 });

clientHealthScoreSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Calculate overall health score
  const components = this.components;
  this.healthScore = Math.round(
    components.awareness.score * components.awareness.weight +
    components.engagement.score * components.engagement.weight +
    components.growth.score * components.growth.weight +
    components.quality.score * components.quality.weight +
    components.sentiment.score * components.sentiment.weight
  );

  // Determine status
  if (this.healthScore >= 80) this.status = 'excellent';
  else if (this.healthScore >= 65) this.status = 'good';
  else if (this.healthScore >= 50) this.status = 'fair';
  else if (this.healthScore >= 35) this.status = 'needs_attention';
  else this.status = 'critical';

  // Determine trend direction
  if (this.trends.scoreChange > 5) this.trends.direction = 'improving';
  else if (this.trends.scoreChange < -5) this.trends.direction = 'declining';
  else this.trends.direction = 'stable';

  next();
});

module.exports = mongoose.model('ClientHealthScore', clientHealthScoreSchema);



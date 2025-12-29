// Health Alert Model
// Track health score alerts and notifications

const mongoose = require('mongoose');

const healthAlertSchema = new mongoose.Schema({
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Alert Details
  alert: {
    type: {
      type: String,
      enum: ['health_score_drop', 'competitor_overtake', 'sentiment_negative', 'awareness_decline', 'growth_stagnant', 'quality_drop'],
      required: true,
      index: true
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
      index: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    threshold: { type: Number, default: 0 }, // Threshold that triggered alert
    currentValue: { type: Number, default: 0 },
    previousValue: { type: Number, default: 0 }
  },
  // Context
  context: {
    platform: String,
    period: {
      startDate: Date,
      endDate: Date
    },
    component: String, // Which health component
    metric: String // Specific metric
  },
  // Recommendations
  recommendations: [{
    action: String,
    description: String,
    priority: String,
    expectedImpact: String
  }],
  // Status
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
    default: 'active',
    index: true
  },
  // Resolution
  resolution: {
    resolvedAt: Date,
    resolvedBy: mongoose.Schema.Types.ObjectId,
    notes: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  acknowledgedAt: Date,
  resolvedAt: Date
});

healthAlertSchema.index({ clientWorkspaceId: 1, status: 1, createdAt: -1 });
healthAlertSchema.index({ agencyWorkspaceId: 1, status: 1 });
healthAlertSchema.index({ 'alert.severity': 1, status: 1 });

module.exports = mongoose.model('HealthAlert', healthAlertSchema);



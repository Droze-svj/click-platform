// Business Alert Model
// Track business metric alerts

const mongoose = require('mongoose');

const businessAlertSchema = new mongoose.Schema({
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
      enum: ['churn_risk', 'low_nps', 'high_cpa', 'low_utilization', 'retention_drop', 'satisfaction_drop', 'efficiency_drop'],
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
    threshold: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    previousValue: { type: Number, default: 0 }
  },
  // Context
  context: {
    clientWorkspaceId: mongoose.Schema.Types.ObjectId,
    campaignId: mongoose.Schema.Types.ObjectId,
    metric: String,
    period: {
      startDate: Date,
      endDate: Date
    }
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
    notes: String,
    actionsTaken: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  acknowledgedAt: Date,
  resolvedAt: Date
});

businessAlertSchema.index({ agencyWorkspaceId: 1, status: 1, createdAt: -1 });
businessAlertSchema.index({ 'alert.severity': 1, status: 1 });

module.exports = mongoose.model('BusinessAlert', businessAlertSchema);



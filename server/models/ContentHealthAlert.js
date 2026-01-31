// Content Health Alert Model
// Alerts for content health issues

const mongoose = require('mongoose');

const contentHealthAlertSchema = new mongoose.Schema({
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
  alertType: {
    type: String,
    enum: ['score_drop', 'gap_identified', 'platform_issue', 'consistency_issue', 'engagement_drop', 'volume_drop'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    previousScore: Number,
    currentScore: Number,
    platform: String,
    gap: mongoose.Schema.Types.Mixed,
    recommendation: String
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
    default: 'active',
    index: true
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: Date,
  resolvedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

contentHealthAlertSchema.index({ clientWorkspaceId: 1, status: 1, createdAt: -1 });
contentHealthAlertSchema.index({ agencyWorkspaceId: 1, status: 1, createdAt: -1 });
contentHealthAlertSchema.index({ alertType: 1, severity: 1 });

module.exports = mongoose.model('ContentHealthAlert', contentHealthAlertSchema);



// Risk Flag Model
// Automated risk detection for clients

const mongoose = require('mongoose');

const riskFlagSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  // Risk type
  riskType: {
    type: String,
    enum: [
      'falling_engagement',
      'low_posting_frequency',
      'negative_sentiment',
      'content_gap',
      'platform_issues',
      'audience_decline',
      'revenue_drop',
      'churn_risk',
      'other'
    ],
    required: true,
    index: true
  },
  // Severity
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  // Risk details
  details: {
    title: String,
    description: String,
    metrics: {
      current: mongoose.Schema.Types.Mixed,
      previous: mongoose.Schema.Types.Mixed,
      change: mongoose.Schema.Types.Mixed,
      threshold: mongoose.Schema.Types.Mixed
    },
    affectedPlatforms: [String],
    timeframe: {
      start: Date,
      end: Date,
      duration: Number // days
    }
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'false_positive'],
    default: 'active',
    index: true
  },
  // Actions
  actions: [{
    type: {
      type: String,
      enum: ['notify', 'escalate', 'create_task', 'suggest_playbook', 'auto_fix']
    },
    taken: { type: Boolean, default: false },
    takenAt: Date,
    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    result: String
  }],
  // Recommendations
  recommendations: [{
    type: String,
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    description: String,
    estimatedImpact: String,
    playbookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playbook'
    }
  }],
  // Resolution
  resolution: {
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolutionNotes: String,
    resolutionActions: [String]
  },
  // Timeline
  timeline: [{
    event: String,
    timestamp: { type: Date, default: Date.now },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

riskFlagSchema.index({ userId: 1, clientId: 1, status: 1, severity: 1 });
riskFlagSchema.index({ riskType: 1, status: 1, createdAt: -1 });
riskFlagSchema.index({ severity: 1, status: 1, createdAt: -1 });

riskFlagSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Add timeline entry
  if (this.isNew) {
    this.timeline.push({
      event: 'Risk flag created',
      timestamp: new Date()
    });
  }
  
  next();
});

module.exports = mongoose.model('RiskFlag', riskFlagSchema);



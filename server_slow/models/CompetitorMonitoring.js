// Competitor Monitoring Model
// Automated competitor tracking

const mongoose = require('mongoose');

const competitorMonitoringSchema = new mongoose.Schema({
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
  competitor: {
    name: { type: String, required: true },
    handle: { type: String, required: true, index: true },
    platform: {
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
      required: true,
      index: true
    },
    profileUrl: String,
    verified: { type: Boolean, default: false }
  },
  // Monitoring Status
  monitoring: {
    enabled: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    lastChecked: { type: Date, default: Date.now },
    nextCheck: Date
  },
  // Current Metrics
  metrics: {
    followers: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    posts: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    growthRate: { type: Number, default: 0 }
  },
  // Historical Data
  history: [{
    date: { type: Date, required: true },
    followers: Number,
    engagement: Number,
    reach: Number,
    posts: Number,
    engagementRate: Number
  }],
  // Alerts
  alerts: {
    enabled: { type: Boolean, default: true },
    thresholds: {
      followerOvertake: { type: Boolean, default: true },
      engagementOvertake: { type: Boolean, default: true },
      significantGrowth: { type: Boolean, default: true } // Competitor growing faster
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

competitorMonitoringSchema.index({ workspaceId: 1, 'competitor.platform': 1 });
competitorMonitoringSchema.index({ 'monitoring.enabled': 1, 'monitoring.nextCheck': 1 });
competitorMonitoringSchema.index({ clientWorkspaceId: 1, 'competitor.handle': 1 });

competitorMonitoringSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CompetitorMonitoring', competitorMonitoringSchema);



// Client Retention Model
// Track client retention and churn

const mongoose = require('mongoose');

const clientRetentionSchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Client Details
  client: {
    name: { type: String, required: true },
    email: String,
    industry: String,
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'enterprise'],
      index: true
    }
  },
  // Onboarding
  onboarding: {
    startDate: { type: Date, required: true },
    completedDate: Date,
    duration: Number, // Days
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'stalled'],
      default: 'in_progress'
    }
  },
  // Subscription
  subscription: {
    startDate: { type: Date, required: true, index: true },
    endDate: Date,
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'suspended'],
      default: 'active',
      index: true
    },
    renewalDate: Date,
    contractLength: Number, // Months
    monthlyRevenue: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },
  // Churn
  churn: {
    date: Date,
    reason: {
      type: String,
      enum: ['price', 'service', 'results', 'competitor', 'budget', 'other'],
      index: true
    },
    reasonDetails: String,
    churnType: {
      type: String,
      enum: ['voluntary', 'involuntary', 'at_risk'],
      index: true
    },
    predictedChurn: { type: Boolean, default: false },
    churnRiskScore: { type: Number, default: 0, min: 0, max: 100 }
  },
  // Retention Metrics
  retention: {
    monthsActive: { type: Number, default: 0 },
    lifetimeValue: { type: Number, default: 0 },
    averageMonthlyRevenue: { type: Number, default: 0 },
    retentionRate: { type: Number, default: 100 }, // Percentage
    isRetained: { type: Boolean, default: true }
  },
  // Engagement
  engagement: {
    lastActivityDate: Date,
    activityScore: { type: Number, default: 0 }, // 0-100
    loginFrequency: { type: Number, default: 0 }, // Logins per month
    featureUsage: [{
      feature: String,
      usageCount: Number,
      lastUsed: Date
    }]
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

clientRetentionSchema.index({ agencyWorkspaceId: 1, 'subscription.status': 1 });
clientRetentionSchema.index({ agencyWorkspaceId: 1, 'churn.churnRiskScore': -1 });
clientRetentionSchema.index({ 'subscription.startDate': 1 });
clientRetentionSchema.index({ 'churn.date': 1 });

clientRetentionSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Calculate retention metrics
  if (this.subscription.startDate) {
    const now = new Date();
    const monthsDiff = Math.floor((now - this.subscription.startDate) / (1000 * 60 * 60 * 24 * 30));
    this.retention.monthsActive = monthsDiff;

    // Calculate lifetime value
    this.retention.lifetimeValue = this.subscription.totalRevenue || 0;
    this.retention.averageMonthlyRevenue = this.retention.monthsActive > 0
      ? this.retention.lifetimeValue / this.retention.monthsActive
      : this.subscription.monthlyRevenue || 0;

    // Calculate retention rate
    if (this.subscription.status === 'active') {
      this.retention.retentionRate = 100;
      this.retention.isRetained = true;
    } else if (this.subscription.status === 'cancelled' || this.subscription.status === 'expired') {
      this.retention.retentionRate = 0;
      this.retention.isRetained = false;
    }
  }

  next();
});

module.exports = mongoose.model('ClientRetention', clientRetentionSchema);



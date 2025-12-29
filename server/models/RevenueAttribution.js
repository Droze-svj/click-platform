// Revenue Attribution Model
// Track revenue and ROAS/ROI

const mongoose = require('mongoose');

const revenueAttributionSchema = new mongoose.Schema({
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
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    index: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    index: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    index: true
  },
  // Period
  period: {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true }
  },
  // Revenue Metrics
  revenue: {
    gross: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    attributed: { type: Number, default: 0 }, // Revenue attributed to this source
    lifetimeValue: { type: Number, default: 0 }
  },
  // Cost Metrics
  costs: {
    adSpend: { type: Number, default: 0 },
    agencyFees: { type: Number, default: 0 },
    contentCreation: { type: Number, default: 0 },
    tools: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  // Performance Metrics
  metrics: {
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 }, // Click-through rate
    conversionRate: { type: Number, default: 0 },
    costPerClick: { type: Number, default: 0 },
    costPerConversion: { type: Number, default: 0 },
    revenuePerClick: { type: Number, default: 0 },
    revenuePerConversion: { type: Number, default: 0 }
  },
  // ROAS/ROI
  roas: {
    value: { type: Number, default: 0 }, // Return on Ad Spend
    percentage: { type: Number, default: 0 }
  },
  roi: {
    value: { type: Number, default: 0 }, // Return on Investment
    percentage: { type: Number, default: 0 }
  },
  // Attribution Model
  attributionModel: {
    type: String,
    enum: ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based', 'data_driven'],
    default: 'last_touch'
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

revenueAttributionSchema.index({ workspaceId: 1, 'period.startDate': -1 });
revenueAttributionSchema.index({ clientWorkspaceId: 1, 'period.startDate': -1 });
revenueAttributionSchema.index({ agencyWorkspaceId: 1, 'period.startDate': -1 });
revenueAttributionSchema.index({ campaignId: 1, 'period.startDate': -1 });
revenueAttributionSchema.index({ platform: 1, 'period.startDate': -1 });

revenueAttributionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate ROAS
  if (this.costs.adSpend > 0) {
    this.roas.value = this.revenue.attributed / this.costs.adSpend;
    this.roas.percentage = ((this.revenue.attributed - this.costs.adSpend) / this.costs.adSpend) * 100;
  }
  
  // Calculate ROI
  if (this.costs.total > 0) {
    this.roi.value = this.revenue.attributed / this.costs.total;
    this.roi.percentage = ((this.revenue.attributed - this.costs.total) / this.costs.total) * 100;
  }
  
  // Calculate metrics
  if (this.metrics.clicks > 0) {
    this.metrics.costPerClick = this.costs.total / this.metrics.clicks;
    this.metrics.revenuePerClick = this.revenue.attributed / this.metrics.clicks;
  }
  
  if (this.metrics.conversions > 0) {
    this.metrics.costPerConversion = this.costs.total / this.metrics.conversions;
    this.metrics.revenuePerConversion = this.revenue.attributed / this.metrics.conversions;
    this.metrics.conversionRate = (this.metrics.conversions / this.metrics.clicks) * 100;
  }
  
  next();
});

module.exports = mongoose.model('RevenueAttribution', revenueAttributionSchema);



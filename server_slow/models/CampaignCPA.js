// Campaign CPA/CLTV Model
// Track cost per acquisition and customer lifetime value

const mongoose = require('mongoose');

const campaignCPASchema = new mongoose.Schema({
  agencyWorkspaceId: {
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
  // Campaign Details
  campaign: {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['social_ads', 'influencer', 'content', 'paid_social', 'other'],
      required: true,
      index: true
    },
    platform: {
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'multi'],
      required: true,
      index: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: Date,
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active',
      index: true
    }
  },
  // Costs
  costs: {
    adSpend: { type: Number, default: 0 },
    agencyFee: { type: Number, default: 0 },
    creativeCost: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  // Performance
  performance: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    signUps: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 }
  },
  // CPA Metrics
  cpa: {
    costPerAcquisition: { type: Number, default: 0 },
    costPerLead: { type: Number, default: 0 },
    costPerClick: { type: Number, default: 0 },
    costPerConversion: { type: Number, default: 0 },
    costPerMille: { type: Number, default: 0 } // CPM
  },
  // CLTV Metrics
  cltv: {
    customerLifetimeValue: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    purchaseFrequency: { type: Number, default: 0 },
    customerLifespan: { type: Number, default: 0 }, // Months
    cltvToCACRatio: { type: Number, default: 0 } // CLTV / CPA
  },
  // ROI
  roi: {
    returnOnAdSpend: { type: Number, default: 0 }, // ROAS
    returnOnInvestment: { type: Number, default: 0 }, // ROI
    profit: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 } // Percentage
  },
  // Attribution
  attribution: {
    model: {
      type: String,
      enum: ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based'],
      default: 'last_touch'
    },
    conversionWindow: { type: Number, default: 30 }, // Days
    touchpoints: [{
      date: Date,
      type: String,
      value: Number
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

campaignCPASchema.index({ agencyWorkspaceId: 1, 'campaign.startDate': -1 });
campaignCPASchema.index({ clientWorkspaceId: 1, 'campaign.status': 1 });
campaignCPASchema.index({ 'campaign.type': 1, 'campaign.status': 1 });

campaignCPASchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Calculate total costs
  this.costs.total = 
    this.costs.adSpend +
    this.costs.agencyFee +
    this.costs.creativeCost +
    this.costs.platformFee +
    this.costs.other;

  // Calculate CPA metrics
  if (this.performance.conversions > 0) {
    this.cpa.costPerAcquisition = this.costs.total / this.performance.conversions;
  }
  if (this.performance.leads > 0) {
    this.cpa.costPerLead = this.costs.total / this.performance.leads;
  }
  if (this.performance.clicks > 0) {
    this.cpa.costPerClick = this.costs.total / this.performance.clicks;
  }
  if (this.performance.conversions > 0) {
    this.cpa.costPerConversion = this.costs.total / this.performance.conversions;
  }
  if (this.performance.impressions > 0) {
    this.cpa.costPerMille = (this.costs.total / this.performance.impressions) * 1000;
  }

  // Calculate CLTV
  if (this.performance.purchases > 0) {
    this.cltv.averageOrderValue = this.performance.revenue / this.performance.purchases;
  }
  this.cltv.customerLifetimeValue = 
    this.cltv.averageOrderValue * 
    this.cltv.purchaseFrequency * 
    this.cltv.customerLifespan;

  // Calculate CLTV to CAC ratio
  if (this.cpa.costPerAcquisition > 0) {
    this.cltv.cltvToCACRatio = this.cltv.customerLifetimeValue / this.cpa.costPerAcquisition;
  }

  // Calculate ROI
  if (this.costs.adSpend > 0) {
    this.roi.returnOnAdSpend = (this.performance.revenue / this.costs.adSpend) * 100;
  }
  if (this.costs.total > 0) {
    this.roi.returnOnInvestment = ((this.performance.revenue - this.costs.total) / this.costs.total) * 100;
    this.roi.profit = this.performance.revenue - this.costs.total;
    this.roi.profitMargin = (this.roi.profit / this.performance.revenue) * 100;
  }

  next();
});

module.exports = mongoose.model('CampaignCPA', campaignCPASchema);



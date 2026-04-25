// Client Value Tracking Model
// Track cost, value, and ROI per client and campaign

const mongoose = require('mongoose');

const clientValueTrackingSchema = new mongoose.Schema({
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
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    index: true
  },
  period: {
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true
    },
    month: {
      type: Number,
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: true
    }
  },
  cost: {
    timeSpent: {
      type: Number,
      default: 0 // hours
    },
    timeCost: {
      type: Number,
      default: 0 // cost of time in dollars
    },
    toolCost: {
      type: Number,
      default: 0 // tool/subscription costs
    },
    adSpend: {
      type: Number,
      default: 0 // paid advertising spend
    },
    total: {
      type: Number,
      default: 0
    }
  },
  value: {
    impressions: {
      type: Number,
      default: 0
    },
    reach: {
      type: Number,
      default: 0
    },
    engagement: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    leads: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0 // estimated revenue from conversions
    },
    timeSaved: {
      type: Number,
      default: 0 // hours saved through automation
    },
    timeSavedValue: {
      type: Number,
      default: 0 // dollar value of time saved
    }
  },
  metrics: {
    roi: {
      type: Number,
      default: 0 // (value - cost) / cost * 100
    },
    costPerImpression: {
      type: Number,
      default: 0
    },
    costPerLead: {
      type: Number,
      default: 0
    },
    costPerConversion: {
      type: Number,
      default: 0
    },
    engagementRate: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    timeEfficiency: {
      type: Number,
      default: 0 // time saved / time spent
    }
  },
  breakdown: {
    byPlatform: [{
      platform: String,
      cost: Number,
      impressions: Number,
      engagement: Number,
      leads: Number,
      conversions: Number,
      roi: Number
    }],
    byContentType: [{
      contentType: String,
      cost: Number,
      value: Number,
      posts: Number
    }],
    byCampaign: [{
      campaignId: mongoose.Schema.Types.ObjectId,
      campaignName: String,
      cost: Number,
      value: Number,
      roi: Number
    }]
  },
  metadata: {
    serviceTier: String, // bronze, silver, gold
    hourlyRate: Number, // agency hourly rate
    conversionValue: Number, // average value per conversion
    leadValue: Number // average value per lead
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

clientValueTrackingSchema.index({ clientWorkspaceId: 1, 'period.year': 1, 'period.month': 1 });
clientValueTrackingSchema.index({ agencyWorkspaceId: 1, 'period.year': 1, 'period.month': 1 });
clientValueTrackingSchema.index({ campaignId: 1, 'period.startDate': 1 });

clientValueTrackingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate total cost
  this.cost.total = this.cost.timeCost + this.cost.toolCost + this.cost.adSpend;
  
  // Calculate ROI
  const totalValue = this.value.revenue + this.value.timeSavedValue;
  if (this.cost.total > 0) {
    this.metrics.roi = ((totalValue - this.cost.total) / this.cost.total) * 100;
  }
  
  // Calculate cost per metrics
  if (this.value.impressions > 0) {
    this.metrics.costPerImpression = this.cost.total / this.value.impressions;
  }
  if (this.value.leads > 0) {
    this.metrics.costPerLead = this.cost.total / this.value.leads;
  }
  if (this.value.conversions > 0) {
    this.metrics.costPerConversion = this.cost.total / this.value.conversions;
  }
  
  // Calculate rates
  if (this.value.reach > 0) {
    this.metrics.engagementRate = (this.value.engagement / this.value.reach) * 100;
  }
  if (this.value.leads > 0) {
    this.metrics.conversionRate = (this.value.conversions / this.value.leads) * 100;
  }
  
  // Calculate time efficiency
  if (this.cost.timeSpent > 0) {
    this.metrics.timeEfficiency = (this.value.timeSaved / this.cost.timeSpent) * 100;
  }
  
  next();
});

module.exports = mongoose.model('ClientValueTracking', clientValueTrackingSchema);



// Customer Lifetime Value Model
// Track customer LTV and revenue over time

const mongoose = require('mongoose');

const customerLTVSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  customerId: {
    type: String,
    required: true,
    index: true
  },
  // First Conversion
  firstConversion: {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledPost'
    },
    platform: String,
    conversionType: String,
    timestamp: Date,
    value: Number
  },
  // Attribution
  attribution: {
    source: String,
    medium: String,
    campaign: String,
    firstTouch: {
      postId: mongoose.Schema.Types.ObjectId,
      platform: String,
      timestamp: Date
    },
    lastTouch: {
      postId: mongoose.Schema.Types.ObjectId,
      platform: String,
      timestamp: Date
    },
    touchpoints: [{
      postId: mongoose.Schema.Types.ObjectId,
      platform: String,
      timestamp: Date,
      interaction: String
    }]
  },
  // Revenue Tracking
  revenue: {
    total: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    purchaseCount: { type: Number, default: 0 },
    firstPurchase: { type: Number, default: 0 },
    lastPurchase: { type: Number, default: 0 }
  },
  // LTV Calculation
  ltv: {
    current: { type: Number, default: 0 },
    predicted: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    calculationMethod: {
      type: String,
      enum: ['historical', 'predictive', 'cohort'],
      default: 'historical'
    }
  },
  // Customer Metrics
  metrics: {
    acquisitionCost: { type: Number, default: 0 },
    daysSinceFirstPurchase: { type: Number, default: 0 },
    averageDaysBetweenPurchases: { type: Number, default: 0 },
    churnRisk: { type: Number, default: 0 }, // 0-100
    retentionScore: { type: Number, default: 0 } // 0-100
  },
  // Cohort
  cohort: {
    month: String, // YYYY-MM
    year: Number
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

customerLTVSchema.index({ workspaceId: 1, customerId: 1 });
customerLTVSchema.index({ workspaceId: 1, 'cohort.month': 1 });
customerLTVSchema.index({ 'attribution.campaign': 1 });
customerLTVSchema.index({ 'firstConversion.timestamp': 1 });

customerLTVSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate days since first purchase
  if (this.firstConversion?.timestamp) {
    this.metrics.daysSinceFirstPurchase = Math.floor(
      (new Date() - new Date(this.firstConversion.timestamp)) / (1000 * 60 * 60 * 24)
    );
  }
  
  // Calculate average order value
  if (this.revenue.purchaseCount > 0) {
    this.revenue.averageOrderValue = this.revenue.total / this.revenue.purchaseCount;
  }
  
  next();
});

module.exports = mongoose.model('CustomerLTV', customerLTVSchema);



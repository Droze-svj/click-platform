// Integration Marketplace Model
// Available integrations in the marketplace

const mongoose = require('mongoose');

const marketplaceSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['cms', 'dam', 'crm', 'ad_platform', 'data_warehouse', 'analytics', 'other'],
    required: true,
    index: true
  },
  logo: String,
  website: String,
  documentation: String,
  authType: {
    type: String,
    enum: ['api_key', 'oauth', 'basic', 'bearer'],
    required: true
  },
  features: [{
    type: String,
    enum: [
      'content_sync',
      'asset_sync',
      'user_sync',
      'analytics_sync',
      'webhook_support',
      'real_time',
      'batch_operations'
    ]
  }],
  api: {
    baseUrl: String,
    endpoints: mongoose.Schema.Types.Mixed,
    rateLimit: {
      requests: Number,
      period: Number
    },
    authentication: {
      type: String,
      enum: ['api_key', 'oauth', 'basic', 'bearer']
    }
  },
  config: {
    requiredFields: [String],
    optionalFields: [String],
    fieldDescriptions: mongoose.Schema.Types.Mixed
  },
  pricing: {
    tier: {
      type: String,
      enum: ['free', 'paid', 'enterprise'],
      default: 'free'
    },
    cost: Number,
    currency: String
  },
  stats: {
    installs: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false
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

marketplaceSchema.index({ category: 1, isActive: 1 });
marketplaceSchema.index({ isVerified: 1, isActive: 1 });

marketplaceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('IntegrationMarketplace', marketplaceSchema);



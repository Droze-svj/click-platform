// Usage-Based Tier Model
// Simple, transparent pricing with clear usage limits

const mongoose = require('mongoose');

const usageBasedTierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  tier: {
    type: String,
    enum: ['creator', 'agency', 'business', 'enterprise'],
    required: true
  },
  description: String,
  // Clear pricing
  pricing: {
    monthly: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'USD' }
    },
    yearly: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
      discount: { type: Number, default: 0 } // Percentage discount
    }
  },
  // Usage limits - CLEAR and TRANSPARENT
  usage: {
    // AI minutes/credits
    aiMinutes: {
      monthly: { type: Number, required: true }, // Minutes of AI processing per month
      overageRate: { type: Number, default: 0 } // Cost per minute over limit
    },
    // Credits (alternative to minutes)
    credits: {
      monthly: { type: Number, default: null }, // If using credit system
      perCredit: { type: Number, default: 1 } // Cost per credit
    },
    // Client/workspace limits
    clients: {
      max: { type: Number, required: true }, // Max client workspaces
      overageRate: { type: Number, default: 0 } // Cost per client over limit
    },
    // Connected profiles
    profiles: {
      max: { type: Number, required: true }, // Max connected social profiles
      overageRate: { type: Number, default: 0 } // Cost per profile over limit
    },
    // Content limits
    content: {
      postsPerMonth: { type: Number, default: -1 }, // -1 = unlimited
      videosPerMonth: { type: Number, default: 0 },
      reportsPerMonth: { type: Number, default: 10 }
    }
  },
  // Features - ALL ESSENTIAL FEATURES INCLUDED (no hidden essentials)
  features: {
    // Core features (always included)
    scheduler: { type: Boolean, default: true }, // NOT locked behind top plans
    branding: { type: Boolean, default: true }, // NOT locked behind top plans
    analytics: { type: Boolean, default: true },
    contentLibrary: { type: Boolean, default: true },
    approvalWorkflows: { type: Boolean, default: true },
    // Advanced features
    whiteLabel: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    bulkOperations: { type: Boolean, default: false },
    customIntegrations: { type: Boolean, default: false },
    sso: { type: Boolean, default: false },
    dedicatedSupport: { type: Boolean, default: false }
  },
  // Support level
  support: {
    level: {
      type: String,
      enum: ['email', 'priority', 'dedicated'],
      default: 'email'
    },
    responseTime: String, // e.g., "24 hours", "4 hours", "1 hour"
    channels: [String] // ['email', 'chat', 'phone']
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: 0
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

usageBasedTierSchema.index({ tier: 1, isActive: 1 });
usageBasedTierSchema.index({ slug: 1 });

usageBasedTierSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UsageBasedTier', usageBasedTierSchema);



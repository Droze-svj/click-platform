// Agency Scale Plan Model
// Bundles for agencies: X clients, Y profiles, Z AI minutes

const mongoose = require('mongoose');

const agencyScalePlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  // Clear bundle pricing
  pricing: {
    monthly: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'USD' }
    },
    yearly: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
      discount: { type: Number, default: 0 }
    }
  },
  // Clear bundle limits - easy to forecast
  bundle: {
    clients: {
      included: { type: Number, required: true }, // X clients included
      overageRate: { type: Number, default: 0 } // Cost per additional client
    },
    profiles: {
      included: { type: Number, required: true }, // Y connected profiles
      overageRate: { type: Number, default: 0 } // Cost per additional profile
    },
    aiMinutes: {
      included: { type: Number, required: true }, // Z AI minutes per month
      overageRate: { type: Number, default: 0 } // Cost per minute over
    }
  },
  // Additional limits
  limits: {
    teamMembers: { type: Number, default: 5 },
    storage: { type: Number, default: 100 }, // GB
    apiCalls: { type: Number, default: 10000 } // Per month
  },
  // Agency-specific features
  features: {
    multiClientWorkspaces: { type: Boolean, default: true },
    whiteLabelPortals: { type: Boolean, default: true },
    clientApprovalDashboards: { type: Boolean, default: true },
    crossClientBenchmarking: { type: Boolean, default: true },
    bulkScheduling: { type: Boolean, default: true },
    whiteLabelReporting: { type: Boolean, default: true },
    perClientBilling: { type: Boolean, default: true },
    customBranding: { type: Boolean, default: true }
  },
  // Support
  support: {
    level: {
      type: String,
      enum: ['priority', 'dedicated'],
      default: 'priority'
    },
    responseTime: String,
    channels: [String],
    accountManager: { type: Boolean, default: false }
  },
  // Growth path - show next tier
  nextTier: {
    tierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgencyScalePlan'
    },
    upgradeMessage: String
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
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

agencyScalePlanSchema.index({ isActive: 1, displayOrder: 1 });
agencyScalePlanSchema.index({ slug: 1 });

agencyScalePlanSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AgencyScalePlan', agencyScalePlanSchema);



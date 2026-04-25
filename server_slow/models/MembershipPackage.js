// Membership package model

const mongoose = require('mongoose');

const membershipPackageSchema = new mongoose.Schema({
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
  description: String,
  price: {
    monthly: Number,
    yearly: Number
  },
  features: {
    videoProcessing: {
      maxVideosPerMonth: { type: Number, default: -1 }, // -1 = unlimited
      maxVideoLength: Number, // in seconds
      maxVideoSize: Number, // in bytes
      allowHD: { type: Boolean, default: false }
    },
    contentGeneration: {
      maxGenerationsPerMonth: { type: Number, default: -1 },
      maxTextLength: Number,
      platforms: [String] // ['twitter', 'linkedin', 'instagram', etc.]
    },
    scripts: {
      maxScriptsPerMonth: { type: Number, default: -1 },
      scriptTypes: [String] // ['youtube', 'podcast', 'blog', etc.]
    },
    music: {
      maxMusicFiles: { type: Number, default: 0 },
      maxMusicSize: Number
    },
    storage: {
      maxStorage: Number, // in bytes
      maxFiles: { type: Number, default: -1 }
    },
    collaboration: {
      maxSharedUsers: { type: Number, default: 0 },
      allowPublicSharing: { type: Boolean, default: false }
    },
    analytics: {
      advancedAnalytics: { type: Boolean, default: false },
      exportData: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false }
    },
    support: {
      prioritySupport: { type: Boolean, default: false },
      emailSupport: { type: Boolean, default: true }
    }
  },
  limits: {
    maxProjects: { type: Number, default: 10 },
    maxTeamMembers: { type: Number, default: 1 },
    maxApiCallsPerDay: { type: Number, default: 1000 },
    maxBrands: { type: Number, default: 1 }, // Number of brand/workspace profiles
    maxClientWorkspaces: { type: Number, default: 0 } // For agency tier - multi-client management
  },
  agencyFeatures: {
    multiClientWorkspaces: { type: Boolean, default: false },
    whiteLabelPortals: { type: Boolean, default: false },
    clientApprovalDashboards: { type: Boolean, default: false },
    crossClientBenchmarking: { type: Boolean, default: false },
    bulkScheduling: { type: Boolean, default: false },
    whiteLabelReporting: { type: Boolean, default: false },
    perClientBilling: { type: Boolean, default: false }
  },
  enterpriseFeatures: {
    sso: { type: Boolean, default: false },
    sla: { type: Boolean, default: false },
    advancedIntegrations: { type: Boolean, default: false },
    fullApiAccess: { type: Boolean, default: false },
    dedicatedSupport: { type: Boolean, default: false },
    customIntegrations: { type: Boolean, default: false },
    dataWarehouseExport: { type: Boolean, default: false },
    onPremiseDeployment: { type: Boolean, default: false }
  },
  businessIntelligence: {
    advancedDashboards: { type: Boolean, default: false },
    customReports: { type: Boolean, default: false },
    dataExport: { type: Boolean, default: false },
    roiTracking: { type: Boolean, default: false },
    predictiveAnalytics: { type: Boolean, default: false }
  },
  pricing: {
    isCustom: { type: Boolean, default: false }, // For Enterprise - custom pricing
    contactSales: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  sortOrder: {
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

// Indexes
// Note: slug already has unique: true in field definition, so no need to index again
membershipPackageSchema.index({ isActive: 1, sortOrder: 1 });

membershipPackageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  next();
});

module.exports = mongoose.model('MembershipPackage', membershipPackageSchema);








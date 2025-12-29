// AI Music Provider Configuration Model
// Stores API credentials and license information for AI music generation services

const mongoose = require('mongoose');

const aiMusicProviderConfigSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['mubert', 'soundraw'],
    required: true,
    unique: true,
    index: true
  },
  // API credentials
  apiKey: {
    type: String,
    required: true,
    select: false // Don't return by default
  },
  apiSecret: String,
  // License information
  licenseType: {
    type: String,
    enum: ['free', 'commercial', 'enterprise'],
    default: 'commercial',
    required: true
  },
  enterpriseLicense: {
    type: Boolean,
    default: false
  },
  // License coverage
  allowsCommercialUse: {
    type: Boolean,
    default: true
  },
  allowsSocialPlatforms: {
    type: Boolean,
    default: true
  },
  supportedPlatforms: [{
    type: String,
    enum: ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'snapchat', 'all']
  }],
  allowsMonetization: {
    type: Boolean,
    default: true
  },
  allowsSaaSIntegration: {
    type: Boolean,
    default: false // Must be explicitly enabled
  },
  requiresAttribution: {
    type: Boolean,
    default: false // AI-generated typically doesn't require attribution
  },
  // Configuration
  enabled: {
    type: Boolean,
    default: true
  },
  apiBaseUrl: String,
  // Rate limits
  rateLimit: {
    requestsPerMinute: Number,
    requestsPerDay: Number,
    generationsPerMonth: Number
  },
  // Status
  lastUsedAt: Date,
  usageCount: {
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

aiMusicProviderConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to validate license coverage
aiMusicProviderConfigSchema.methods.validateLicenseCoverage = function(requirements) {
  const {
    commercialUse = false,
    socialPlatforms = false,
    monetization = false,
    saasIntegration = false,
    platform = null
  } = requirements;

  // Check commercial use
  if (commercialUse && !this.allowsCommercialUse) {
    return { valid: false, reason: 'Commercial use not allowed' };
  }

  // Check social platforms
  if (socialPlatforms && !this.allowsSocialPlatforms) {
    return { valid: false, reason: 'Social platform use not allowed' };
  }

  // Check specific platform
  if (platform && !this.supportedPlatforms.includes('all') && !this.supportedPlatforms.includes(platform)) {
    return { valid: false, reason: `Platform ${platform} not supported` };
  }

  // Check monetization
  if (monetization && !this.allowsMonetization) {
    return { valid: false, reason: 'Monetization not allowed' };
  }

  // Check SaaS integration
  if (saasIntegration && !this.allowsSaaSIntegration) {
    return { valid: false, reason: 'SaaS integration not allowed' };
  }

  return { valid: true };
};

module.exports = mongoose.model('AIMusicProviderConfig', aiMusicProviderConfigSchema);








// Music Provider Configuration Model
// Stores API credentials and configuration for music licensing providers

const mongoose = require('mongoose');

const musicProviderConfigSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['soundstripe', 'artlist', 'hooksounds', 'epidemic_sound', 'audiojungle', 'other'],
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
  accessToken: String,
  refreshToken: String,
  tokenExpiresAt: Date,
  // Configuration
  enabled: {
    type: Boolean,
    default: true
  },
  catalogEnabled: {
    type: Boolean,
    default: false // Whether catalog embedding is enabled
  },
  // License type allowed
  allowedLicenseTypes: [{
    type: String,
    enum: ['saas_catalog', 'individual_use', 'commercial', 'extended']
  }],
  // API endpoints
  apiBaseUrl: String,
  searchEndpoint: String,
  downloadEndpoint: String,
  previewEndpoint: String,
  // Rate limits
  rateLimit: {
    requestsPerMinute: Number,
    requestsPerDay: Number
  },
  // Provider-specific settings
  settings: mongoose.Schema.Types.Mixed,
  // Status
  lastSyncedAt: Date,
  syncStatus: {
    type: String,
    enum: ['active', 'failed', 'paused'],
    default: 'active'
  },
  lastError: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

musicProviderConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if API credentials are valid (without exposing them)
musicProviderConfigSchema.methods.hasValidCredentials = function() {
  return !!(this.apiKey && this.enabled);
};

module.exports = mongoose.model('MusicProviderConfig', musicProviderConfigSchema);








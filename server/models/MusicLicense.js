// Music License Model
// Tracks licensing information for external music providers

const mongoose = require('mongoose');

const musicLicenseSchema = new mongoose.Schema({
  // Provider information
  provider: {
    type: String,
    enum: ['soundstripe', 'artlist', 'hooksounds', 'epidemic_sound', 'audiojungle', 'other'],
    required: true,
    index: true
  },
  providerTrackId: {
    type: String,
    required: true,
    index: true
  },
  // License details
  licenseType: {
    type: String,
    enum: ['saas_catalog', 'individual_use', 'commercial', 'extended'],
    required: true
  },
  allowsEmbedding: {
    type: Boolean,
    default: false
  },
  allowsSaaSIntegration: {
    type: Boolean,
    default: false
  },
  requiresAttribution: {
    type: Boolean,
    default: true
  },
  // Track metadata
  title: {
    type: String,
    required: true
  },
  artist: String,
  album: String,
  genre: [String],
  mood: [String],
  tags: [String],
  duration: Number, // in seconds
  bpm: Number,
  key: String, // Musical key
  // Media URLs (from provider)
  previewUrl: String,
  downloadUrl: String,
  thumbnailUrl: String,
  waveformUrl: String,
  // License metadata
  licenseStartDate: {
    type: Date,
    default: Date.now
  },
  licenseEndDate: Date, // null for perpetual licenses
  licenseStatus: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'pending'],
    default: 'active',
    index: true
  },
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  usageLimit: {
    type: Number // Maximum number of times this license can be used (null = unlimited)
  },
  lastUsedAt: Date,
  // Attribution requirements
  attributionText: String, // Required attribution text if any
  // Provider-specific metadata
  providerMetadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes
musicLicenseSchema.index({ provider: 1, providerTrackId: 1 }, { unique: true });
musicLicenseSchema.index({ licenseStatus: 1, licenseEndDate: 1 });
musicLicenseSchema.index({ genre: 1, mood: 1 });

musicLicenseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MusicLicense', musicLicenseSchema);


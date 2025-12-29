// Music License Usage Model
// Logs all music track usage for licensing compliance

const mongoose = require('mongoose');

const musicLicenseUsageSchema = new mongoose.Schema({
  // Track information
  trackId: {
    type: String,
    required: true,
    index: true
  },
  source: {
    type: String,
    enum: ['licensed', 'ai_generated', 'user_upload'],
    required: true
  },
  provider: {
    type: String // 'soundstripe', 'artlist', 'mubert', 'soundraw', etc.
  },
  providerTrackId: {
    type: String // Provider's track ID
  },
  // License information
  licenseType: {
    type: String,
    enum: ['platform', 'per_user', 'per_export', 'per_end_user', 'user_owned', 'ai_generated'],
    required: true
  },
  licenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MusicLicense'
  },
  // Usage context
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content'
  },
  renderId: {
    type: String // Unique render ID
  },
  // Render information
  renderTimestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  exportFormat: {
    type: String // 'mp4', 'webm', etc.
  },
  exportResolution: {
    type: String // '1080p', '720p', etc.
  },
  exportPlatform: {
    type: String // 'youtube', 'tiktok', etc. if known
  },
  // License registration
  providerLicenseRegistered: {
    type: Boolean,
    default: false
  },
  providerLicenseId: {
    type: String // License ID from provider API
  },
  providerRegistrationResponse: {
    type: mongoose.Schema.Types.Mixed // Full response from provider
  },
  // Attribution
  attributionRequired: {
    type: Boolean,
    default: false
  },
  attributionText: {
    type: String
  },
  trackTitle: {
    type: String // Stored for attribution generation
  },
  trackArtist: {
    type: String // Stored for attribution generation
  },
  attributionAdded: {
    type: Boolean,
    default: false
  },
  attributionLocation: {
    type: String,
    enum: ['description', 'metadata', 'credits', 'none']
  },
  // Restrictions
  restrictions: {
    downloadRawAudio: {
      type: Boolean,
      default: false // True if download is blocked
    },
    exportInVideoOnly: {
      type: Boolean,
      default: true // True if can only export in video
    }
  },
  // Compliance
  complianceStatus: {
    type: String,
    enum: ['compliant', 'pending', 'failed', 'disputed'],
    default: 'compliant'
  },
  complianceNotes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

musicLicenseUsageSchema.index({ userId: 1, renderTimestamp: -1 });
musicLicenseUsageSchema.index({ provider: 1, providerTrackId: 1, renderTimestamp: -1 });
musicLicenseUsageSchema.index({ licenseId: 1, renderTimestamp: -1 });
musicLicenseUsageSchema.index({ projectId: 1, renderTimestamp: -1 });
musicLicenseUsageSchema.index({ complianceStatus: 1 });

module.exports = mongoose.model('MusicLicenseUsage', musicLicenseUsageSchema);


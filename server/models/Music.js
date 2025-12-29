// Music library model

const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  artist: String,
  genre: {
    type: String,
    enum: ['pop', 'rock', 'electronic', 'hip-hop', 'classical', 'jazz', 'ambient', 'upbeat', 'calm', 'energetic', 'other'],
    default: 'other'
  },
  mood: {
    type: String,
    enum: ['happy', 'sad', 'energetic', 'calm', 'dramatic', 'inspiring', 'funny', 'serious'],
    default: 'energetic'
  },
  file: {
    url: String,
    filename: String,
    size: Number,
    duration: Number // in seconds
  },
  thumbnail: String,
  isPublic: {
    type: Boolean,
    default: false
  },
  license: {
    type: String,
    enum: ['royalty-free', 'licensed', 'user-uploaded', 'external-provider'],
    default: 'user-uploaded'
  },
  // Reference to licensed track if from external provider
  licenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MusicLicense',
    default: null
  },
  provider: {
    type: String,
    enum: ['soundstripe', 'artlist', 'hooksounds', 'epidemic_sound', 'audiojungle', 'internal'],
    default: 'internal'
  },
  providerTrackId: String,
  tags: [String],
  usageCount: {
    type: Number,
    default: 0
  },
  // License attestation for user-uploaded tracks
  licenseAttestation: {
    type: Boolean,
    default: false // User attests they own/hold rights to use this track
  },
  attestationDate: {
    type: Date // When user attested to ownership
  },
  requiresAttribution: {
    type: Boolean,
    default: false // If attribution is required for this track
  },
  attributionText: {
    type: String // Attribution text if required
  },
  // Privacy: User tracks stay private per user/workspace
  // isPublic should always be false for user uploads
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
musicSchema.index({ userId: 1, createdAt: -1 });
musicSchema.index({ workspaceId: 1, createdAt: -1 });
musicSchema.index({ genre: 1 });
musicSchema.index({ mood: 1 });
musicSchema.index({ isPublic: 1 });
musicSchema.index({ licenseAttestation: 1 });

// Ensure user uploads stay private
musicSchema.pre('save', function(next) {
  // User-uploaded tracks (provider === 'internal' or license === 'user-uploaded')
  // should always be private
  if (this.provider === 'internal' || this.license === 'user-uploaded') {
    this.isPublic = false;
  }
  next();
});

module.exports = mongoose.model('Music', musicSchema);








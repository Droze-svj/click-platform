// Music Generation Model
// Tracks AI-generated music tracks

const mongoose = require('mongoose');

const musicGenerationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  provider: {
    type: String,
    enum: ['mubert', 'soundraw'],
    required: true,
    index: true
  },
  jobId: {
    type: String,
    required: true
  },
  trackId: String,
  // Generation parameters
  params: {
    mood: String,
    genre: String,
    duration: Number,
    bpm: Number,
    intensity: String,
    tempo: String
  },
  // Status
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
    index: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  error: String,
  // License information
  licenseInfo: {
    allowsCommercialUse: Boolean,
    allowsSocialPlatforms: Boolean,
    platforms: [String],
    allowsMonetization: Boolean,
    allowsSaaSIntegration: Boolean,
    requiresAttribution: Boolean,
    licenseType: String
  },
  // Metadata
  metadata: {
    cost: Number,
    costTrackedAt: Date,
    hasUnlimitedPlan: Boolean,
    popularityScore: Number
  },
  // Generated track
  downloadUrl: String,
  fileUrl: String,
  musicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Music',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: Date
});

musicGenerationSchema.index({ userId: 1, createdAt: -1 });
musicGenerationSchema.index({ provider: 1, status: 1 });

// Pre-save hook to set completedAt
musicGenerationSchema.pre('save', function(next) {
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('MusicGeneration', musicGenerationSchema);


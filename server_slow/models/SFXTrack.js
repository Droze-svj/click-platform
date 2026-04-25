// SFX Track Model
// Represents sound effects on the editor timeline

const mongoose = require('mongoose');

const sfxTrackSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // SFX information
  sfxType: {
    type: String,
    enum: ['whoosh', 'click', 'transition', 'impact', 'ambient', 'custom'],
    required: true
  },
  fileUrl: {
    type: String,
    required: true // URL to SFX audio file
  },
  // Timeline positioning
  startTime: {
    type: Number,
    required: true // Start time in seconds on timeline
  },
  duration: {
    type: Number,
    required: true // Duration in seconds
  },
  // Audio processing
  volume: {
    type: Number,
    default: 0 // Volume in dB
  },
  fadeIn: {
    duration: {
      type: Number,
      default: 0
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  fadeOut: {
    duration: {
      type: Number,
      default: 0
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  // Layer/track ordering
  layer: {
    type: Number,
    default: 0
  },
  muted: {
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

sfxTrackSchema.index({ projectId: 1, layer: -1 });
sfxTrackSchema.index({ projectId: 1, startTime: 1 });

sfxTrackSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SFXTrack', sfxTrackSchema);








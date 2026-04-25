// Music Track Model
// Represents a music track on the editor timeline

const mongoose = require('mongoose');

const volumeAutomationPointSchema = new mongoose.Schema({
  time: {
    type: Number,
    required: true // Time in seconds from track start
  },
  volume: {
    type: Number,
    required: true, // Volume in dB (e.g., -18 for background, 0 for full)
    default: 0
  }
});

const musicTrackSchema = new mongoose.Schema({
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
  // Source track information
  sourceTrackId: {
    type: String,
    required: true // ID of track from catalog (licenseId, musicId, etc.)
  },
  source: {
    type: String,
    enum: ['licensed', 'ai_generated', 'user_upload'],
    required: true
  },
  // Timeline positioning
  startTime: {
    type: Number,
    default: 0 // Start time in seconds on timeline
  },
  duration: {
    type: Number,
    required: true // Duration in seconds
  },
  sourceStartTime: {
    type: Number,
    default: 0 // Trim start: start position in source track
  },
  sourceEndTime: {
    type: Number // Trim end: end position in source track (null = end of track)
  },
  // Audio processing
  volume: {
    type: Number,
    default: 0 // Volume in dB (0 = full volume, negative = quieter)
  },
  fadeIn: {
    duration: {
      type: Number,
      default: 0 // Fade-in duration in seconds
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  fadeOut: {
    duration: {
      type: Number,
      default: 0 // Fade-out duration in seconds
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  volumeAutomation: {
    type: [volumeAutomationPointSchema],
    default: []
  },
  // Advanced features
  loop: {
    enabled: {
      type: Boolean,
      default: false
    },
    count: {
      type: Number,
      default: 1 // Number of loops (1 = no loop)
    }
  },
  fitToVideoLength: {
    type: Boolean,
    default: false // Auto-adjust duration to match video
  },
  autoDucking: {
    enabled: {
      type: Boolean,
      default: false
    },
    sensitivity: {
      type: Number,
      default: 0.7 // Speech detection sensitivity (0-1)
    },
    duckAmount: {
      type: Number,
      default: -18 // Volume reduction in dB when speech detected
    }
  },
  // Smart alignment
  alignment: {
    type: {
      type: String,
      enum: ['none', 'scene_boundary', 'key_moment', 'beat', 'manual'],
      default: 'none'
    },
    targetSceneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scene'
    },
    targetTime: {
      type: Number // Target alignment time in seconds
    },
    snapOffset: {
      type: Number,
      default: 0 // Offset from snap point in seconds
    }
  },
  // Preset used
  preset: {
    name: String,
    appliedAt: Date
  },
  // Layer/track ordering
  layer: {
    type: Number,
    default: 0 // Higher number = higher layer (on top)
  },
  muted: {
    type: Boolean,
    default: false
  },
  solo: {
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

musicTrackSchema.index({ projectId: 1, layer: -1 });
musicTrackSchema.index({ projectId: 1, startTime: 1 });

musicTrackSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MusicTrack', musicTrackSchema);








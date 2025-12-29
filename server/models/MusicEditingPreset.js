// Music Editing Preset Model
// Pre-configured editing presets

const mongoose = require('mongoose');

const musicEditingPresetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  // Preset configuration
  config: {
    volume: {
      type: Number,
      default: 0
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
    autoDucking: {
      enabled: {
        type: Boolean,
        default: false
      },
      sensitivity: {
        type: Number,
        default: 0.7
      },
      duckAmount: {
        type: Number,
        default: -18
      }
    },
    fitToVideoLength: {
      type: Boolean,
      default: false
    },
    alignment: {
      type: {
        type: String,
        enum: ['none', 'scene_boundary', 'key_moment', 'beat'],
        default: 'none'
      }
    }
  },
  // Use case tags
  useCases: [{
    type: String,
    enum: ['background', 'foreground', 'intro', 'outro', 'transition', 'highlight', 'vlog', 'tutorial']
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  isSystem: {
    type: Boolean,
    default: false // System presets (e.g., "background bed at -18dB")
  },
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

musicEditingPresetSchema.index({ userId: 1, createdAt: -1 });
musicEditingPresetSchema.index({ isPublic: 1, isSystem: 1 });
musicEditingPresetSchema.index({ useCases: 1 });

musicEditingPresetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MusicEditingPreset', musicEditingPresetSchema);








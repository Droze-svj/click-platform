// Scene Model
// Stores detected scenes from video content with metadata

const mongoose = require('mongoose');

const sceneSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
    // Indexed in compound indexes below
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  start: {
    type: Number,
    required: true,
    min: 0
  },
  end: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    required: true,
    min: 0
  },
  sceneIndex: {
    type: Number,
    required: true,
    min: 0
  },
  confidence: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  // Scene promotion/ranking
  isHighlight: {
    type: Boolean,
    default: false,
    index: true
  },
  isPromoted: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: Number,
    default: 0,
    min: -10,
    max: 10
  },
  // Key moment tags
  isKeyMoment: {
    type: Boolean,
    default: false,
    index: true
  },
  keyMomentReason: {
    type: String,
    enum: ['motion_spike', 'slide_change', 'high_engagement', 'speech_peak', 'user_marked', null],
    default: null
  },
  // Scene editing and versioning
  isMerged: {
    type: Boolean,
    default: false
  },
  mergedFrom: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scene'
  }],
  splitInto: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scene'
  }],
  version: {
    type: Number,
    default: 1
  },
  // Scene notes/comments
  notes: String,
  // Custom tags
  customTags: [{
    type: String,
    index: true
  }],
  metadata: {
    // Scene type labels
    label: {
      type: String,
      default: null
    },
    // Dominant colors in the scene (RGB values)
    dominantColors: [{
      r: Number,
      g: Number,
      b: Number,
      percentage: Number
    }],
    // Face detection
    hasFaces: {
      type: Boolean,
      default: false
    },
    faceCount: {
      type: Number,
      default: 0
    },
    // Speech activity
    hasSpeech: {
      type: Boolean,
      default: false
    },
    speechConfidence: {
      type: Number,
      min: 0,
      max: 1
    },
    // Scene-specific labels (e.g., "talking head", "screen share", "B-roll")
    tags: [{
      type: String
    }],
    // Average brightness
    brightness: {
      type: Number,
      min: 0,
      max: 255
    },
    // Motion level (0-1)
    motionLevel: {
      type: Number,
      min: 0,
      max: 1
    },
    // Scene thumbnail URL
    thumbnailUrl: {
      type: String,
      default: null
    }
  },
  // Detection parameters used
  detectionParams: {
    sensitivity: {
      type: Number,
      default: 0.3
    },
    minSceneLength: {
      type: Number,
      default: 1.0
    },
    fps: {
      type: Number,
      default: 3
    },
    useMultiModal: {
      type: Boolean,
      default: true
    },
    workflowType: {
      type: String,
      enum: ['general', 'tiktok', 'youtube', 'instagram'],
      default: 'general'
    },
    mergeShortScenes: {
      type: Boolean,
      default: true
    }
  },
  // Multi-modal detection sources
  detectionSources: [{
    type: String,
    enum: ['visual', 'audio', 'text', 'default']
  }],
  // Audio cues detected
  audioCues: [{
    type: {
      type: String,
      enum: [
        'music_change', 
        'silence', 
        'applause', 
        'volume_change', 
        'speech_change', 
        'speaker_change',
        'audio_change', // Generic audio change point
        'voice_to_music',
        'music_to_voice',
        'voice_to_silence',
        'silence_to_voice',
        'music_to_silence',
        'silence_to_music'
      ]
    },
    timestamp: Number,
    confidence: Number,
    duration: Number,
    distance: Number, // Feature vector distance
    metrics: mongoose.Schema.Types.Mixed,
    features: mongoose.Schema.Types.Mixed,
    method: {
      type: String,
      enum: ['distance_peak', 'class_transition', 'feature_distance', 'basic']
    }
  }],
  // Advanced audio features (aggregated per scene)
  audioFeatures: {
    energy: {
      mean: Number,
      variance: Number,
      max: Number,
      min: Number,
      changes: {
        mean: Number,
        max: Number,
        count: Number
      }
    },
    spectral: {
      centroid: {
        mean: Number,
        variance: Number
      },
      bandwidth: {
        mean: Number,
        variance: Number
      },
      zeroCrossingRate: {
        mean: Number,
        variance: Number
      },
      mfccs: [{
        mean: Number,
        variance: Number
      }]
    },
    classification: {
      voice: { type: Number, min: 0, max: 1 },
      music: { type: Number, min: 0, max: 1 },
      silence: { type: Number, min: 0, max: 1 }
    },
    speakerChange: {
      count: Number,
      probability: Number,
      hasChange: Boolean
    }
  },
  // Scene quality metrics
  quality: {
    overall: {
      type: Number,
      min: 0,
      max: 1
    },
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'F']
    },
    factors: mongoose.Schema.Types.Mixed
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

// Indexes for efficient querying
sceneSchema.index({ contentId: 1, sceneIndex: 1 }, { unique: true });
sceneSchema.index({ userId: 1, createdAt: -1 });
sceneSchema.index({ contentId: 1, start: 1 });
sceneSchema.index({ 'metadata.tags': 1 });
sceneSchema.index({ 'metadata.label': 1 });

// Pre-save hook to calculate duration
sceneSchema.pre('save', function(next) {
  if (this.isModified('start') || this.isModified('end')) {
    this.duration = this.end - this.start;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Scene', sceneSchema);


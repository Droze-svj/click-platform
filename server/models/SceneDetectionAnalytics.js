// Scene Detection Analytics Model
// Tracks metrics for continuous improvement

const mongoose = require('mongoose');

const sceneDetectionAnalyticsSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true
  },
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
  // Detection results
  sceneCount: {
    type: Number,
    required: true
  },
  averageSceneLength: {
    type: Number,
    required: true
  },
  minSceneLength: {
    type: Number
  },
  maxSceneLength: {
    type: Number
  },
  // Parameters used
  sensitivity: Number,
  minSceneLengthParam: Number,
  maxSceneLengthParam: Number,
  useMultiModal: Boolean,
  workflowType: String,
  // User edits (tracked over time)
  userEdits: {
    scenesMerged: {
      type: Number,
      default: 0
    },
    scenesSplit: {
      type: Number,
      default: 0
    },
    scenesDeleted: {
      type: Number,
      default: 0
    },
    scenesPromoted: {
      type: Number,
      default: 0
    },
    totalEdits: {
      type: Number,
      default: 0
    }
  },
  // Quality metrics
  averageQuality: Number,
  highQualityScenes: Number, // Quality >= 0.7
  // Detection method effectiveness
  detectionSources: {
    visual: Number,
    audio: Number,
    text: Number
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
sceneDetectionAnalyticsSchema.index({ workspaceId: 1, createdAt: -1 });
sceneDetectionAnalyticsSchema.index({ userId: 1, createdAt: -1 });
sceneDetectionAnalyticsSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SceneDetectionAnalytics', sceneDetectionAnalyticsSchema);








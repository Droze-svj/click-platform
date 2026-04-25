// Scene Detection Job Model
// Tracks async scene detection jobs and their status

const mongoose = require('mongoose');

const sceneDetectionJobSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  currentStep: {
    type: String,
    default: null
  },
  // Detection parameters used
  parameters: {
    sensitivity: Number,
    minSceneLength: Number,
    maxSceneLength: Number,
    fps: Number,
    useMultiModal: Boolean,
    workflowType: String,
    extractMetadata: Boolean
  },
  // Results
  sceneCount: {
    type: Number,
    default: 0
  },
  error: {
    message: String,
    stack: String
  },
  // Timing
  startedAt: Date,
  completedAt: Date,
  duration: Number, // in seconds
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
sceneDetectionJobSchema.index({ contentId: 1, status: 1 });
sceneDetectionJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
sceneDetectionJobSchema.index({ workspaceId: 1, status: 1 });

// Pre-save hook to update duration
sceneDetectionJobSchema.pre('save', function(next) {
  if (this.isModified('completedAt') && this.completedAt && this.startedAt) {
    this.duration = (this.completedAt - this.startedAt) / 1000;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SceneDetectionJob', sceneDetectionJobSchema);








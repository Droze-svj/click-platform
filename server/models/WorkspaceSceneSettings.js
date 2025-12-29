// Workspace Scene Detection Settings Model
// Advanced configuration per workspace

const mongoose = require('mongoose');

const workspaceSceneSettingsSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true
  },
  // Detection sensitivity (0.1 - 1.0)
  defaultSensitivity: {
    type: Number,
    default: 0.3,
    min: 0.1,
    max: 1.0
  },
  // Scene length constraints
  defaultMinSceneLength: {
    type: Number,
    default: 1.0,
    min: 0.5
  },
  defaultMaxSceneLength: {
    type: Number,
    default: null, // null = no limit
    min: 1.0
  },
  // Transcript language for segmentation
  transcriptLanguage: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'auto']
  },
  // Feature flags
  enableMultiModal: {
    type: Boolean,
    default: true
  },
  enableAudioAnalysis: {
    type: Boolean,
    default: true
  },
  enableTextSegmentation: {
    type: Boolean,
    default: true
  },
  enableAdvancedAudioAnalysis: {
    type: Boolean,
    default: true
  },
  // Cost control: disable heavy AI features
  disableHeavyAIAnalysis: {
    type: Boolean,
    default: false
  },
  // Auto-detect scenes on upload
  autoDetectOnUpload: {
    type: Boolean,
    default: true
  },
  // Auto-detect only for videos shorter than this (seconds)
  autoDetectMaxDuration: {
    type: Number,
    default: 600, // 10 minutes
    min: 0
  },
  // Default workflow type
  defaultWorkflowType: {
    type: String,
    enum: ['general', 'tiktok', 'youtube', 'instagram'],
    default: 'general'
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

// Pre-save hook
workspaceSceneSettingsSchema.pre('save', function(next) {
  // If heavy AI is disabled, also disable advanced features
  if (this.disableHeavyAIAnalysis) {
    this.enableAdvancedAudioAnalysis = false;
    this.enableMultiModal = false;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('WorkspaceSceneSettings', workspaceSceneSettingsSchema);








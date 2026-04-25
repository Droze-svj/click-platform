// Model Version Schema
// Tracks AI model versions and upgrades

const mongoose = require('mongoose');

const modelVersionSchema = new mongoose.Schema({
  // Model identification
  provider: {
    type: String,
    required: true,
    enum: ['openrouter', 'huggingface', 'cerebras', 'replicate', 'openai'],
    index: true,
  },
  model: {
    type: String,
    required: true,
    index: true,
  },

  // Version information
  version: {
    type: String,
    required: true,
    index: true,
  },
  previousVersion: {
    type: String,
  },
  current: {
    type: Boolean,
    default: true,
    index: true,
  },
  deprecated: {
    type: Date,
  },
  released: {
    type: Date,
    default: Date.now,
  },

  // Upgrade information
  improvements: [{
    type: String,
  }],
  breakingChanges: [{
    type: String,
  }],
  migrationNotes: {
    type: String,
  },

  // Performance metrics at time of release
  baselinePerformance: {
    avgQualityScore: Number,
    avgResponseTime: Number,
    avgTokens: Number,
  },

  // Metadata
  releaseNotes: {
    type: String,
  },
  changelog: {
    type: String,
  },
}, {
  timestamps: true,
});

// Compound index
modelVersionSchema.index({ provider: 1, model: 1, current: 1 });
modelVersionSchema.index({ provider: 1, model: 1, version: 1 });

module.exports = mongoose.model('ModelVersion', modelVersionSchema);



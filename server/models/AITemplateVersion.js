// AI Template Version Model
// Version history for AI templates

const mongoose = require('mongoose');

const aiTemplateVersionSchema = new mongoose.Schema({
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AITemplate',
    required: true,
    index: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  // Snapshot of template at this version
  snapshot: {
    prompt: String,
    systemMessage: String,
    guardrails: mongoose.Schema.Types.Mixed,
    brandStyle: mongoose.Schema.Types.Mixed,
    contentRules: mongoose.Schema.Types.Mixed,
    platformRules: mongoose.Schema.Types.Mixed,
    settings: mongoose.Schema.Types.Mixed
  },
  // Change description
  changeDescription: String,
  // Performance metrics at this version
  performance: {
    usageCount: { type: Number, default: 0 },
    averageConfidence: Number,
    averageEditEffort: Number,
    userSatisfaction: Number
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

aiTemplateVersionSchema.index({ templateId: 1, versionNumber: 1 }, { unique: true });
aiTemplateVersionSchema.index({ templateId: 1, createdAt: -1 });

module.exports = mongoose.model('AITemplateVersion', aiTemplateVersionSchema);



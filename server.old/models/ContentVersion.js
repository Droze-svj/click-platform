// Content versioning model

const mongoose = require('mongoose');

const contentVersionSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  version: {
    type: Number,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: String,
  description: String,
  transcript: String,
  generatedContent: {
    type: mongoose.Schema.Types.Mixed
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  changeSummary: {
    type: String,
    default: ''
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  isCurrent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

contentVersionSchema.index({ contentId: 1, version: -1 });
contentVersionSchema.index({ contentId: 1, isCurrent: 1 });

module.exports = mongoose.model('ContentVersion', contentVersionSchema);

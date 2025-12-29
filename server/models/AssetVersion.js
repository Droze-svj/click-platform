// Asset Version Model
// Tracks versions of content assets

const mongoose = require('mongoose');

const assetVersionSchema = new mongoose.Schema({
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
  version: {
    type: Number,
    required: true,
    default: 1
  },
  versionName: {
    type: String,
    default: ''
  },
  changes: {
    type: String,
    default: ''
  },
  content: {
    title: String,
    description: String,
    body: String,
    transcript: String,
    tags: [String],
    category: String
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    fileSize: Number,
    fileUrl: String
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

assetVersionSchema.index({ contentId: 1, version: 1 }, { unique: true });
assetVersionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AssetVersion', assetVersionSchema);



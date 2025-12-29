// Asset Collection Model
// Collections of related assets

const mongoose = require('mongoose');

const assetCollectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  contentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content'
  }],
  coverImage: {
    type: String,
    default: null
  },
  tags: [{
    type: String
  }],
  category: {
    type: String,
    default: 'general'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isSmart: {
    type: Boolean,
    default: false
  },
  smartRules: {
    tags: [String],
    categories: [String],
    types: [String],
    dateRange: {
      start: Date,
      end: Date
    },
    performanceThreshold: {
      minEngagement: Number,
      minViews: Number
    }
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

assetCollectionSchema.index({ userId: 1, name: 1 });
assetCollectionSchema.index({ userId: 1, isSmart: 1 });

assetCollectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AssetCollection', assetCollectionSchema);



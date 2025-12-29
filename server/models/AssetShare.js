// Asset Share Model
// Manages asset sharing and collaboration

const mongoose = require('mongoose');

const assetShareSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    permission: {
      type: String,
      enum: ['view', 'edit', 'comment'],
      default: 'view'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  publicLink: {
    type: String,
    unique: true,
    sparse: true
  },
  accessCode: {
    type: String,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  allowDownload: {
    type: Boolean,
    default: false
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastViewed: {
    type: Date,
    default: null
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

assetShareSchema.index({ contentId: 1, ownerId: 1 });
assetShareSchema.index({ publicLink: 1 });
assetShareSchema.index({ 'sharedWith.userId': 1 });

assetShareSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Generate public link if public
  if (this.isPublic && !this.publicLink) {
    this.publicLink = `asset-${this.contentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  next();
});

module.exports = mongoose.model('AssetShare', assetShareSchema);



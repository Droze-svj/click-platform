// Post Version Model
// Version history for posts with comparison support

const mongoose = require('mongoose');

const postVersionSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content'
  },
  versionNumber: {
    type: Number,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changeReason: {
    type: String,
    default: ''
  },
  content: {
    text: String,
    mediaUrl: String,
    hashtags: [String],
    mentions: [String]
  },
  metadata: {
    platform: String,
    scheduledTime: Date,
    changes: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }]
  },
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: {
      type: String,
      required: true
    },
    lineNumber: Number, // For inline comments
    position: {
      x: Number,
      y: Number
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  approvalStatus: {
    type: String,
    enum: ['draft', 'pending_review', 'pending_approval', 'approved', 'rejected'],
    default: 'draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

postVersionSchema.index({ postId: 1, versionNumber: 1 }, { unique: true });
postVersionSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('PostVersion', postVersionSchema);



// Post Comment Model
// Comments directly on posts with threading

const mongoose = require('mongoose');

const postCommentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true,
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  portalUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientPortalUser',
    index: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['comment', 'suggestion', 'question', 'approval', 'rejection'],
    default: 'comment'
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PostComment',
    default: null
  },
  inlineComment: {
    enabled: { type: Boolean, default: false },
    lineNumber: Number,
    selectedText: String,
    position: {
      x: Number,
      y: Number
    }
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'link']
    },
    url: String,
    name: String,
    size: Number
  }],
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['like', 'helpful', 'agree', 'disagree']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  isInternal: {
    type: Boolean,
    default: false // false = visible to client, true = internal only
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  editedAt: Date,
  deletedAt: Date
});

postCommentSchema.index({ postId: 1, createdAt: -1 });
postCommentSchema.index({ parentCommentId: 1 });
postCommentSchema.index({ userId: 1, createdAt: -1 });

postCommentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PostComment', postCommentSchema);



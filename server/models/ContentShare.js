// Content sharing model

const mongoose = require('mongoose');

const contentShareSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sharedWith: {
    type: {
      type: String,
      enum: ['user', 'team'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    }
  },
  permission: {
    type: String,
    enum: ['view', 'edit', 'comment'],
    default: 'view'
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

contentShareSchema.index({ contentId: 1 });
contentShareSchema.index({ 'sharedWith.userId': 1 });
contentShareSchema.index({ 'sharedWith.teamId': 1 });
contentShareSchema.index({ sharedBy: 1 });

module.exports = mongoose.model('ContentShare', contentShareSchema);








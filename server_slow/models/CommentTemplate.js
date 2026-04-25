// Comment Template Model
// Reusable comment templates

const mongoose = require('mongoose');

const commentTemplateSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  name: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['comment', 'suggestion', 'question', 'approval', 'rejection'],
    default: 'comment'
  },
  category: {
    type: String,
    enum: ['general', 'legal', 'compliance', 'brand', 'tone', 'grammar', 'other'],
    default: 'general'
  },
  tags: [String],
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date,
  isPublic: {
    type: Boolean,
    default: false // false = workspace only, true = available to all
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

commentTemplateSchema.index({ workspaceId: 1, category: 1 });
commentTemplateSchema.index({ agencyWorkspaceId: 1, category: 1 });

commentTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CommentTemplate', commentTemplateSchema);



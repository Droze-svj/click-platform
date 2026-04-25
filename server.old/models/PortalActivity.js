// Portal Activity Model
// Activity feed for client portal

const mongoose = require('mongoose');

const portalActivitySchema = new mongoose.Schema({
  portalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhiteLabelPortal',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  type: {
    type: String,
    enum: [
      'post_scheduled',
      'post_published',
      'content_approved',
      'content_rejected',
      'content_created',
      'report_generated',
      'link_created',
      'link_clicked',
      'user_login',
      'comment_added',
      'change_requested'
    ],
    required: true
  },
  actor: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    portalUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClientPortalUser'
    },
    name: String,
    type: {
      type: String,
      enum: ['agency', 'client']
    }
  },
  target: {
    type: {
      type: String,
      enum: ['post', 'content', 'link', 'report', 'user']
    },
    id: mongoose.Schema.Types.ObjectId,
    title: String,
    url: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

portalActivitySchema.index({ portalId: 1, createdAt: -1 });
portalActivitySchema.index({ clientWorkspaceId: 1, createdAt: -1 });
portalActivitySchema.index({ 'actor.portalUserId': 1, isRead: 1 });

module.exports = mongoose.model('PortalActivity', portalActivitySchema);



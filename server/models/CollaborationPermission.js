// Collaboration Permission Model

const mongoose = require('mongoose');

const collaborationPermissionSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['owner', 'editor', 'viewer', 'commenter'],
    default: 'viewer',
  },
  permissions: {
    canEdit: {
      type: Boolean,
      default: false,
    },
    canComment: {
      type: Boolean,
      default: true,
    },
    canShare: {
      type: Boolean,
      default: false,
    },
    canDelete: {
      type: Boolean,
      default: false,
    },
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  invitedAt: {
    type: Date,
    default: Date.now,
  },
  acceptedAt: Date,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
});

collaborationPermissionSchema.index({ contentId: 1, userId: 1 }, { unique: true });
collaborationPermissionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('CollaborationPermission', collaborationPermissionSchema);







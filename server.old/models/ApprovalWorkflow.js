// Approval Workflow Model
// Defines approval workflows for content

const mongoose = require('mongoose');

const approvalWorkflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stages: [{
    order: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    approvers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      role: {
        type: String,
        enum: ['required', 'optional', 'any'],
        default: 'required'
      },
      order: {
        type: Number,
        default: 0
      }
    }],
    approvalType: {
      type: String,
      enum: ['all', 'any', 'majority'],
      default: 'all'
    },
    autoApprove: {
      type: Boolean,
      default: false
    },
    autoApproveAfter: {
      type: Number, // hours
      default: null
    },
    conditions: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    canReject: {
      type: Boolean,
      default: true
    },
    canRequestChanges: {
      type: Boolean,
      default: true
    }
  }],
  settings: {
    allowParallelApprovals: {
      type: Boolean,
      default: false
    },
    notifyOnStageChange: {
      type: Boolean,
      default: true
    },
    notifyOnRejection: {
      type: Boolean,
      default: true
    },
    allowCreatorEdit: {
      type: Boolean,
      default: true
    },
    requireAllStages: {
      type: Boolean,
      default: true
    }
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

// Indexes
approvalWorkflowSchema.index({ userId: 1, isActive: 1 });
approvalWorkflowSchema.index({ teamId: 1, isActive: 1 });
approvalWorkflowSchema.index({ isDefault: 1, userId: 1 });

// Update updatedAt on save
approvalWorkflowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);



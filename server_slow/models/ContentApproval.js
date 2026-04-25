// Content Approval Model
// Tracks approval status for content items

const mongoose = require('mongoose');

const contentApprovalSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApprovalWorkflow',
    default: null
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  workflowStep: {
    type: Number,
    default: null
  },
  workflowTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkflowTemplate',
    default: null
  },
  approverRole: {
    type: String,
    enum: ['owner', 'admin', 'approver', 'editor'],
    default: 'approver'
  },
  timeout: {
    type: Date,
    default: null
  },
  escalation: {
    escalated: { type: Boolean, default: false },
    escalatedTo: mongoose.Schema.Types.ObjectId,
    escalatedAt: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentStage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected', 'changes_requested', 'cancelled'],
    default: 'pending'
  },
  stages: [{
    stageOrder: {
      type: Number,
      required: true
    },
    stageName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'approved', 'rejected', 'changes_requested', 'skipped'],
      default: 'pending'
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    approvals: [{
      approverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'changes_requested'],
        default: 'pending'
      },
      comment: {
        type: String,
        default: ''
      },
      rejectionReason: {
        type: String,
        default: ''
      },
      requestedChanges: {
        type: String,
        default: ''
      },
      approvedAt: {
        type: Date,
        default: null
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    autoApproved: {
      type: Boolean,
      default: false
    },
    autoApprovedAt: {
      type: Date,
      default: null
    }
  }],
  history: [{
    action: {
      type: String,
      enum: ['created', 'stage_started', 'stage_completed', 'approved', 'rejected', 'changes_requested', 'reassigned', 'cancelled'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    stageOrder: {
      type: Number,
      default: null
    },
    comment: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  assignedTo: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    stageOrder: {
      type: Number,
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],
  finalApprover: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  metadata: {
    clientId: mongoose.Schema.Types.ObjectId,
    agencyId: mongoose.Schema.Types.ObjectId,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    tags: [String]
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
contentApprovalSchema.index({ contentId: 1 });
contentApprovalSchema.index({ workflowId: 1 });
contentApprovalSchema.index({ createdBy: 1, status: 1 });
contentApprovalSchema.index({ 'assignedTo.userId': 1, status: 1 });
contentApprovalSchema.index({ status: 1, createdAt: -1 });

// Update updatedAt on save
contentApprovalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for pending approvals count
contentApprovalSchema.virtual('pendingApprovalsCount').get(function() {
  if (!this.stages || this.stages.length === 0) return 0;
  const currentStage = this.stages.find(s => s.stageOrder === this.currentStage);
  if (!currentStage) return 0;
  return currentStage.approvals.filter(a => a.status === 'pending').length;
});

module.exports = mongoose.model('ContentApproval', contentApprovalSchema);


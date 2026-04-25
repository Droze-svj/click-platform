// Workflow Template Model (Enhanced)
// Pre-configured multi-step workflows

const mongoose = require('mongoose');

const workflowTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workflow: {
    stages: [{
      stageOrder: {
        type: Number,
        required: true
      },
      stageName: {
        type: String,
        required: true
      },
      stageType: {
        type: String,
        enum: ['creator', 'internal_review', 'client_approval', 'scheduled'],
        required: true
      },
      approvers: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        role: {
          type: String,
          enum: ['required', 'optional', 'any']
        },
        email: String, // For client approvers without accounts
        name: String
      }],
      approvalType: {
        type: String,
        enum: ['all', 'any', 'majority'],
        default: 'all'
      },
      conditions: {
        contentType: [String], // Apply only to specific content types
        platforms: [String], // Apply only to specific platforms
        tags: [String], // Apply only to content with these tags
        minPriority: {
          type: String,
          enum: ['low', 'medium', 'high']
        }
      },
      sla: {
        enabled: { type: Boolean, default: false },
        hours: Number, // Hours to approve
        autoApprove: { type: Boolean, default: false },
        escalateTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    }],
    settings: {
      allowParallelApprovals: { type: Boolean, default: false },
      allowDelegation: { type: Boolean, default: true },
      requireAllStages: { type: Boolean, default: true },
      autoScheduleOnApproval: { type: Boolean, default: true },
      notifyOnStageChange: { type: Boolean, default: true }
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isShared: {
    type: Boolean,
    default: false
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

workflowTemplateSchema.index({ agencyWorkspaceId: 1, isDefault: 1 });
workflowTemplateSchema.index({ 'workflow.stages.stageType': 1 });

workflowTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);

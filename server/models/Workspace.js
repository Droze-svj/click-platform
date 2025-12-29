// Workspace Model
// Multi-brand/multi-client workspaces

const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['brand', 'client', 'team', 'agency'],
    required: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'editor', 'viewer', 'approver', 'contributor'],
      default: 'viewer'
    },
    permissions: {
      // Content permissions
      canCreate: { type: Boolean, default: false },
      canEdit: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
      canPublish: { type: Boolean, default: false },
      canSchedule: { type: Boolean, default: false },
      
      // Workspace permissions
      canManageMembers: { type: Boolean, default: false },
      canManageSettings: { type: Boolean, default: false },
      canViewAnalytics: { type: Boolean, default: true },
      canExportData: { type: Boolean, default: false },
      
      // Approval permissions
      canApprove: { type: Boolean, default: false },
      canReject: { type: Boolean, default: false },
      canRequestChanges: { type: Boolean, default: false },
      
      // Advanced permissions
      canManageWorkflows: { type: Boolean, default: false },
      canManageIntegrations: { type: Boolean, default: false },
      canAccessAPI: { type: Boolean, default: false },
      canManageBilling: { type: Boolean, default: false }
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    joinedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['invited', 'active', 'suspended', 'removed'],
      default: 'invited'
    }
  }],
  settings: {
    branding: {
      logo: String,
      primaryColor: String,
      secondaryColor: String,
      customDomain: String
    },
    dataResidency: {
      region: {
        type: String,
        enum: ['us', 'eu', 'uk', 'asia', 'global'],
        default: 'global'
      },
      compliance: {
        gdpr: { type: Boolean, default: false },
        ccpa: { type: Boolean, default: false },
        hipaa: { type: Boolean, default: false }
      }
    },
    sla: {
      uptime: { type: Number, default: 99.9 }, // percentage
      responseTime: { type: Number, default: 200 }, // milliseconds
      supportResponse: { type: Number, default: 4 }, // hours
      dataRetention: { type: Number, default: 365 } // days
    },
    features: {
      approvals: { type: Boolean, default: true },
      workflows: { type: Boolean, default: true },
      analytics: { type: Boolean, default: true },
      apiAccess: { type: Boolean, default: false }
    }
  },
  agencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  metadata: {
    industry: String,
    size: String,
    description: String,
    tags: [String],
    agencyWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace'
    }
  },
  isActive: {
    type: Boolean,
    default: true
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

workspaceSchema.index({ ownerId: 1, type: 1 });
workspaceSchema.index({ 'members.userId': 1 });
workspaceSchema.index({ 'settings.dataResidency.region': 1 });

workspaceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Workspace', workspaceSchema);


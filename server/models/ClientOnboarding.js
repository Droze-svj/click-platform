// Client Onboarding Model
// Automated client onboarding workflows

const mongoose = require('mongoose');

const clientOnboardingSchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'paused', 'failed'],
    default: 'pending',
    index: true
  },
  currentStep: {
    type: Number,
    default: 0
  },
  steps: [{
    stepNumber: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    action: {
      type: String,
      enum: ['create_workspace', 'invite_members', 'setup_portal', 'configure_branding', 'import_content', 'setup_workflows', 'create_approvals', 'schedule_demo', 'send_welcome'],
      required: true
    },
    config: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'skipped', 'failed'],
      default: 'pending'
    },
    completedAt: Date,
    error: String
  }],
  settings: {
    autoProceed: { type: Boolean, default: true },
    sendNotifications: { type: Boolean, default: true },
    createPortal: { type: Boolean, default: true },
    setupWorkflows: { type: Boolean, default: true }
  },
  metadata: {
    clientName: String,
    clientEmail: String,
    clientIndustry: String,
    estimatedStartDate: Date,
    onboardingTemplate: String
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

clientOnboardingSchema.index({ agencyWorkspaceId: 1, status: 1 });
clientOnboardingSchema.index({ clientWorkspaceId: 1 });

clientOnboardingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ClientOnboarding', clientOnboardingSchema);



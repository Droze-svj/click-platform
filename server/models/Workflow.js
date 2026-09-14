// Workflow/step memory model

const mongoose = require('mongoose');

const workflowSchema = new mongoose.Schema({
  // NOTE: kept as String. The agentic pipeline (routes/agentic.js →
  // agenticWorkflowService) keys Workflow/AgenticJob by a STRING userId; flipping
  // to ObjectId would CastError on the UUID-form ids that subsystem threads
  // through. Consistency is enforced instead by routing those writes through the
  // canonical id (see server/utils/userKey.js) so the stored string is always the
  // hex form — never a raw UUID.
  userId: {
    type: String,
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  // Node/edge graph for the visual builder, as written by
  // advancedWorkflowService.createWorkflow({ definition: { nodes, edges, triggers } }).
  // It was never declared, so Mongoose dropped it on save — every workflow was
  // stored with no definition at all — and executeWorkflow then did
  // `const { nodes, edges } = workflow.definition`, which throws on undefined.
  // Create silently lost the graph, execute crashed. Kept Mixed because the
  // builder's node shape is client-defined and evolves independently of `steps`,
  // which models the older linear form.
  definition: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined,
  },
  steps: [{
    order: Number,
    action: {
      type: String,
      enum: ['upload_video', 'generate_content', 'generate_script', 'create_quote', 'schedule_post', 'apply_effects', 'add_music', 'export'],
      required: true
    },
    config: {
      type: mongoose.Schema.Types.Mixed
    },
    conditions: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  frequency: {
    type: Number,
    default: 1 // How many times this workflow has been used
  },
  lastUsed: Date,
  isTemplate: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [String],
  triggers: [{
    type: {
      type: String,
      enum: ['event', 'schedule', 'conditional'],
    },
    config: mongoose.Schema.Types.Mixed,
  }],
  actions: [{
    type: {
      type: String,
    },
    config: mongoose.Schema.Types.Mixed,
  }],
  conditions: [{
    field: String,
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains'],
    },
    value: mongoose.Schema.Types.Mixed,
  }],
  schedule: {
    type: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly', 'cron'],
    },
    time: String,
    cronExpression: String,
    timezone: String,
  },
  executionCount: {
    type: Number,
    default: 0,
  },
  successCount: {
    type: Number,
    default: 0,
  },
  failureCount: {
    type: Number,
    default: 0,
  },
  avgExecutionTime: {
    type: Number,
    default: 0,
  },
  lastExecuted: Date,
  advanced: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'archived'],
    default: 'active',
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
workflowSchema.index({ userId: 1, createdAt: -1 });
workflowSchema.index({ userId: 1, frequency: -1 });
workflowSchema.index({ isTemplate: true, frequency: -1 });
workflowSchema.index({ teamId: 1 });

workflowSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Workflow', workflowSchema);



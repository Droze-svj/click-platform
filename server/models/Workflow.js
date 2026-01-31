// Workflow/step memory model

const mongoose = require('mongoose');

const workflowSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    type: String,
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

workflowSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Workflow', workflowSchema);



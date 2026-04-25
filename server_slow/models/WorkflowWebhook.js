// Workflow webhook model

const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  secret: {
    type: String,
    required: false, // Optional for unsigned webhooks
  },
  events: [{
    type: String,
    enum: [
      'workflow.started',
      'workflow.completed',
      'workflow.failed',
      'workflow.step.completed',
      'workflow.step.failed',
    ],
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  retries: {
    type: Number,
    default: 3,
  },
  timeout: {
    type: Number,
    default: 5000, // milliseconds
  },
  lastTriggered: Date,
  successCount: {
    type: Number,
    default: 0,
  },
  failureCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

webhookSchema.index({ userId: 1, workflowId: 1 });
webhookSchema.index({ isActive: 1 });

webhookSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('WorkflowWebhook', webhookSchema);







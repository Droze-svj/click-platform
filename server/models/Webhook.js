// Webhook Model
// Webhook subscriptions for key events

const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  secret: {
    type: String,
    required: true
  },
  events: [{
    type: String,
    enum: [
      'content.created',
      'content.updated',
      'content.deleted',
      'content.approved',
      'content.rejected',
      'content.published',
      'content.scheduled',
      'post.posted',
      'post.failed',
      'performance.milestone',
      'performance.threshold',
      'approval.requested',
      'approval.completed',
      'workflow.started',
      'workflow.completed',
      'library.content_added',
      'library.content_paused',
      'recycling.plan_created',
      'recycling.reposted',
      'asset.created',
      'asset.updated',
      'asset.deleted',
      'post.scheduled',
      'post.cancelled',
      'performance.milestone_reached',
      'performance.threshold_exceeded',
      'performance.threshold_below',
      'user.created',
      'user.updated',
      'workspace.created',
      'workspace.updated',
      'integration.installed',
      'integration.updated',
      'integration.failed',
      'sync.started',
      'sync.completed',
      'sync.failed'
    ],
    required: true
  }],
  filters: {
    platforms: [String],
    contentTypes: [String],
    tags: [String],
    minEngagement: Number
  },
  headers: {
    type: Map,
    of: String,
    default: {}
  },
  settings: {
    retryAttempts: { type: Number, default: 3 },
    retryDelay: { type: Number, default: 1000 }, // milliseconds
    timeout: { type: Number, default: 30000 }, // milliseconds
    verifySSL: { type: Boolean, default: true },
    batching: {
      enabled: { type: Boolean, default: false },
      maxBatchSize: { type: Number, default: 10 },
      batchWindow: { type: Number, default: 5000 } // milliseconds
    },
    transformation: {
      enabled: { type: Boolean, default: false },
      script: { type: String } // JavaScript transformation script
    },
    rateLimit: {
      enabled: { type: Boolean, default: false },
      maxRequests: { type: Number, default: 100 },
      windowMs: { type: Number, default: 60000 } // 1 minute
    }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'failed'],
    default: 'active',
    index: true
  },
  stats: {
    totalDeliveries: { type: Number, default: 0 },
    successfulDeliveries: { type: Number, default: 0 },
    failedDeliveries: { type: Number, default: 0 },
    lastDelivery: Date,
    lastSuccess: Date,
    lastFailure: Date
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

webhookSchema.index({ userId: 1, status: 1 });
webhookSchema.index({ workspaceId: 1, status: 1 });
webhookSchema.index({ 'events': 1 });

webhookSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Webhook', webhookSchema);

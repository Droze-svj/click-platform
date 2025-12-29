// Integration Model
// Third-party integrations (CMS, DAM, CRM, etc.)

const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['cms', 'dam', 'crm', 'ad_platform', 'data_warehouse', 'analytics', 'other'],
    required: true,
    index: true
  },
  provider: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  config: {
    apiKey: String,
    apiSecret: String,
    baseUrl: String,
    authType: {
      type: String,
      enum: ['api_key', 'oauth', 'basic', 'bearer'],
      default: 'api_key'
    },
    credentials: mongoose.Schema.Types.Mixed,
    customFields: mongoose.Schema.Types.Mixed
  },
  mappings: {
    content: {
      title: String,
      body: String,
      tags: String,
      metadata: mongoose.Schema.Types.Mixed
    },
    assets: {
      url: String,
      type: String,
      metadata: mongoose.Schema.Types.Mixed
    }
  },
  sync: {
    enabled: { type: Boolean, default: false },
    direction: {
      type: String,
      enum: ['push', 'pull', 'bidirectional'],
      default: 'push'
    },
    frequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly'],
      default: 'realtime'
    },
    lastSync: Date,
    nextSync: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error'],
    default: 'active',
    index: true
  },
  health: {
    lastCheck: Date,
    status: {
      type: String,
      enum: ['healthy', 'degraded', 'down'],
      default: 'healthy'
    },
    responseTime: Number,
    errorMessage: String
  },
  metadata: {
    version: String,
    category: String,
    tags: [String],
    marketplaceId: mongoose.Schema.Types.ObjectId
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

integrationSchema.index({ userId: 1, type: 1, status: 1 });
integrationSchema.index({ provider: 1, type: 1 });
integrationSchema.index({ 'sync.enabled': 1, 'sync.nextSync': 1 });

integrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Integration', integrationSchema);



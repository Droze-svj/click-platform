// Audit Log Model
// Comprehensive audit logging for compliance and security

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resourceType: {
    type: String,
    enum: ['content', 'workspace', 'user', 'approval', 'workflow', 'integration', 'settings', 'billing'],
    required: true,
    index: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  details: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    changes: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }]
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: {
      country: String,
      region: String,
      city: String
    },
    device: {
      type: String,
      os: String,
      browser: String
    }
  },
  compliance: {
    gdprRelevant: { type: Boolean, default: false },
    dataCategory: {
      type: String,
      enum: ['personal', 'sensitive', 'public', 'internal']
    },
    retentionPeriod: Number // days
  },
  timestamp: {
    type: Date,
    default: Date.now
    // Index defined below with schema.index()
  }
});

auditLogSchema.index({ workspaceId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ 'compliance.gdprRelevant': 1, timestamp: -1 });

// TTL index for automatic cleanup based on retention
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 0 }); // Disabled by default, set per workspace

module.exports = mongoose.model('AuditLog', auditLogSchema);



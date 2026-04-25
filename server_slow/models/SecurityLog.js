// Security audit log model

const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Can be null for anonymous events
  },
  eventType: {
    type: String,
    enum: [
      'login',
      'login_failed',
      'logout',
      'password_change',
      'password_reset',
      'account_locked',
      'account_unlocked',
      'suspicious_activity',
      'api_access',
      'file_upload',
      'data_export',
      'permission_change',
      'admin_action',
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: String,
  location: {
    country: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Indexes for efficient querying
securityLogSchema.index({ userId: 1, createdAt: -1 });
securityLogSchema.index({ eventType: 1, createdAt: -1 });
securityLogSchema.index({ severity: 1, createdAt: -1 });
securityLogSchema.index({ ipAddress: 1, createdAt: -1 });
securityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SecurityLog', securityLogSchema);







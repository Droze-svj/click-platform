// Platform Status Model
// Track platform health and status

const mongoose = require('mongoose');

const platformStatusSchema = new mongoose.Schema({
  // Component status
  component: {
    type: String,
    required: true,
    enum: [
      'api',
      'database',
      'storage',
      'ai_processing',
      'publishing',
      'analytics',
      'export',
      'integrations'
    ],
    index: true
  },
  // Status
  status: {
    type: String,
    enum: ['operational', 'degraded', 'down', 'maintenance'],
    required: true,
    index: true
  },
  // Details
  details: {
    message: String,
    impact: {
      type: String,
      enum: ['none', 'minor', 'major', 'critical']
    },
    affectedFeatures: [String]
  },
  // Metrics
  metrics: {
    responseTime: Number, // milliseconds
    errorRate: Number, // percentage
    uptime: Number, // percentage
    requests: Number // total requests
  },
  // Timeline
  timeline: [{
    status: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
  }],
  // Maintenance
  maintenance: {
    scheduled: { type: Boolean, default: false },
    startTime: Date,
    endTime: Date,
    message: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

platformStatusSchema.index({ component: 1, status: 1, createdAt: -1 });
platformStatusSchema.index({ status: 1, createdAt: -1 });

platformStatusSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PlatformStatus', platformStatusSchema);



// Job Metrics Model
// Tracks job execution metrics for analytics

const mongoose = require('mongoose');

const jobMetricsSchema = new mongoose.Schema({
  queueName: {
    type: String,
    required: true,
    index: true,
  },
  jobId: {
    type: String,
    required: true,
    index: true,
  },
  duration: {
    type: Number, // milliseconds
    required: true,
  },
  memoryUsage: {
    type: Number, // bytes
    default: 0,
  },
  cpuUsage: {
    type: Number, // percentage
    default: 0,
  },
  cost: {
    type: Number, // estimated cost in dollars
    default: 0,
  },
  success: {
    type: Boolean,
    required: true,
  },
  error: {
    type: String,
    default: null,
  },
  retries: {
    type: Number,
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now
    // Index defined below with schema.index()
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
jobMetricsSchema.index({ queueName: 1, timestamp: -1 });
jobMetricsSchema.index({ jobId: 1 });
jobMetricsSchema.index({ timestamp: -1 });

// TTL index to auto-delete old metrics (keep for 90 days)
jobMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('JobMetrics', jobMetricsSchema);




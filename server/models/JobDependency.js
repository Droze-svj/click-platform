// Job Dependency Model
// Tracks job dependencies

const mongoose = require('mongoose');

const jobDependencySchema = new mongoose.Schema({
  parentJobId: {
    type: String,
    required: true,
    index: true,
  },
  parentQueueName: {
    type: String,
    required: true,
    index: true,
  },
  dependentJob: {
    queueName: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    options: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  dependentJobId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  error: {
    type: String,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
jobDependencySchema.index({ parentJobId: 1, parentQueueName: 1 });
jobDependencySchema.index({ status: 1 });

// TTL index to auto-delete old dependencies (keep for 7 days)
jobDependencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('JobDependency', jobDependencySchema);




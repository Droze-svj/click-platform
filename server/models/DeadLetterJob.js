// Dead Letter Job Model
// Stores permanently failed jobs

const mongoose = require('mongoose');

const deadLetterJobSchema = new mongoose.Schema({
  originalQueueName: {
    type: String,
    required: true
  },
  originalJobId: {
    type: String,
    required: true
  },
  jobName: {
    type: String,
    required: true,
  },
  jobData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  failedReason: {
    type: String,
    required: true,
  },
  attemptsMade: {
    type: Number,
    default: 0,
  },
  originalTimestamp: {
    type: Date,
    required: true,
  },
  movedAt: {
    type: Date,
    default: Date.now
  },
  retried: {
    type: Boolean,
    default: false,
  },
  retriedAt: {
    type: Date,
    default: null,
  },
  retriedJobId: {
    type: String,
    default: null,
  },
  retriedQueueName: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
deadLetterJobSchema.index({ originalQueueName: 1, movedAt: -1 });
deadLetterJobSchema.index({ retried: 1, movedAt: -1 });

// TTL index to auto-delete old dead letter jobs (keep for 90 days)
deadLetterJobSchema.index({ movedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('DeadLetterJob', deadLetterJobSchema);




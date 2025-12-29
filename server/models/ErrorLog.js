// Error Log Model

const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  errorType: {
    type: String,
    required: true,
    index: true,
  },
  errorMessage: {
    type: String,
    required: true,
  },
  statusCode: {
    type: Number,
    required: true,
    index: true,
  },
  errorCode: {
    type: String,
    index: true,
  },
  stack: {
    type: String,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  path: {
    type: String,
    index: true,
  },
  method: {
    type: String,
  },
  ip: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Indexes for common queries
errorLogSchema.index({ timestamp: -1, statusCode: 1 });
errorLogSchema.index({ errorType: 1, timestamp: -1 });
errorLogSchema.index({ userId: 1, timestamp: -1 });

// Auto-delete old logs (older than 90 days)
errorLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);






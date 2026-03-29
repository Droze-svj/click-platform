// Notification model for storing notifications.
// When creating notifications, set priority so user preference (high_only / high_medium) works:
//   high  - billing, security, critical alerts (e.g. subscription expired, payment failed)
//   medium - content ready, approvals, mentions (default)
//   low   - digests, non-urgent tips

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  link: {
    type: String,
    default: null
  },
  category: {
    type: String,
    enum: ['task', 'project', 'content', 'approval', 'mention', 'system', 'workflow'],
    default: null
  },
  context: {
    entityId: { type: mongoose.Schema.Types.Mixed, default: null },
    entityType: { type: String, default: null }
  },
  aiSummary: { type: String, default: null },
  suggestion: { type: String, default: null },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model('Notification', notificationSchema);








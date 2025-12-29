// Usage Tracking Model
// Track monthly usage for billing and limit enforcement

const mongoose = require('mongoose');

const usageTrackingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  period: {
    year: { type: Number, required: true },
    month: { type: Number, required: true } // 1-12
  },
  usage: {
    videosProcessed: { type: Number, default: 0 },
    contentGenerated: { type: Number, default: 0 },
    scriptsGenerated: { type: Number, default: 0 },
    postsScheduled: { type: Number, default: 0 },
    quotesCreated: { type: Number, default: 0 },
    musicFiles: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // in bytes
    brandsCreated: { type: Number, default: 0 },
    clientWorkspacesCreated: { type: Number, default: 0 }
  },
  limits: {
    videosProcessed: { type: Number, default: -1 },
    contentGenerated: { type: Number, default: -1 },
    scriptsGenerated: { type: Number, default: -1 },
    postsScheduled: { type: Number, default: -1 },
    apiCalls: { type: Number, default: -1 },
    storageUsed: { type: Number, default: -1 },
    brandsCreated: { type: Number, default: 1 },
    clientWorkspacesCreated: { type: Number, default: 0 }
  },
  overage: {
    videosProcessed: { type: Number, default: 0 },
    contentGenerated: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }
  },
  overageCharges: {
    total: { type: Number, default: 0 },
    videosProcessed: { type: Number, default: 0 },
    contentGenerated: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }
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

usageTrackingSchema.index({ userId: 1, 'period.year': 1, 'period.month': 1 }, { unique: true });
usageTrackingSchema.index({ userId: 1, createdAt: -1 });

usageTrackingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UsageTracking', usageTrackingSchema);



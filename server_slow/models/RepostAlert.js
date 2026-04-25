// Repost Alert Model
// Alerts for repost performance issues

const mongoose = require('mongoose');

const repostAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContentRecycle',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  metric: {
    type: String,
    enum: ['engagement', 'engagementRate', 'performance', 'decay'],
    required: true
  },
  threshold: {
    type: String,
    enum: ['below', 'above', 'decline'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastTriggered: {
    type: Date,
    default: null
  },
  triggerCount: {
    type: Number,
    default: 0
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

repostAlertSchema.index({ userId: 1, isActive: 1 });
repostAlertSchema.index({ recycleId: 1 });

repostAlertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('RepostAlert', repostAlertSchema);



// Search Alert Model
// Notifies users when new content matches their saved search

const mongoose = require('mongoose');

const searchAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  query: {
    type: String,
    default: ''
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  frequency: {
    type: String,
    enum: ['realtime', 'daily', 'weekly'],
    default: 'daily'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastChecked: {
    type: Date,
    default: Date.now
  },
  lastNotification: {
    type: Date,
    default: null
  },
  notificationCount: {
    type: Number,
    default: 0
  },
  matchedContentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

searchAlertSchema.index({ userId: 1, isActive: 1 });
searchAlertSchema.index({ lastChecked: 1 });
searchAlertSchema.index({ frequency: 1, isActive: 1 });

searchAlertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('SearchAlert', searchAlertSchema);



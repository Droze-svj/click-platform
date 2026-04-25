// Audience Alert Model
// Alerts for audience changes

const mongoose = require('mongoose');

const audienceAlertSchema = new mongoose.Schema({
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
  metric: {
    type: String,
    enum: ['engagement', 'growth', 'retention', 'sentiment', 'engagementRate'],
    required: true
  },
  threshold: {
    type: String,
    enum: ['increase', 'decrease', 'above', 'below'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'all'],
    default: 'all'
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

audienceAlertSchema.index({ userId: 1, isActive: 1 });
audienceAlertSchema.index({ metric: 1, platform: 1 });

audienceAlertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AudienceAlert', audienceAlertSchema);



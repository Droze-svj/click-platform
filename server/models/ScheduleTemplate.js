// Schedule Template Model
// Reusable scheduling configurations

const mongoose = require('mongoose');

const scheduleTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  platforms: [{
    type: String,
    enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads', 'snapchat', 'reddit']
  }],
  scheduleConfig: {
    frequency: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly', 'custom'],
      default: 'once'
    },
    daysOfWeek: [{
      type: Number, // 0 = Sunday, 1 = Monday, etc.
      min: 0,
      max: 6
    }],
    times: [{
      type: String, // HH:MM format
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    }],
    timezone: {
      type: String,
      default: 'UTC'
    },
    startDate: Date,
    endDate: Date,
    maxPosts: Number,
    minSpacing: {
      type: Number, // hours
      default: 2
    }
  },
  contentRules: {
    contentType: [String],
    categories: [String],
    tags: [String],
    excludeTags: [String]
  },
  optimization: {
    useOptimalTimes: {
      type: Boolean,
      default: true
    },
    avoidTimes: {
      hours: [Number],
      days: [Number]
    },
    preferredTimes: {
      type: Map,
      of: [String] // Platform-specific preferred times
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
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

scheduleTemplateSchema.index({ userId: 1, isActive: 1 });
scheduleTemplateSchema.index({ userId: 1, isDefault: 1 });

scheduleTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ScheduleTemplate', scheduleTemplateSchema);



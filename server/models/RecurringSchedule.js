// Recurring Schedule Model
// Manages recurring content schedules

const mongoose = require('mongoose');

const recurringScheduleSchema = new mongoose.Schema({
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
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  platform: {
    type: String,
    enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads', 'snapchat', 'reddit'],
    required: true
  },
  recurrence: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      required: true
    },
    interval: {
      type: Number,
      default: 1 // Every N days/weeks/months
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6
    }],
    dayOfMonth: Number, // For monthly
    times: [{
      type: String, // HH:MM format
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    }],
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: Date,
    maxOccurrences: Number,
    currentOccurrence: {
      type: Number,
      default: 0
    },
    nextScheduledDate: Date
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active'
  },
  autoRefresh: {
    enabled: {
      type: Boolean,
      default: false
    },
    refreshOptions: {
      updateHashtags: Boolean,
      updateCaption: Boolean,
      updateTiming: Boolean
    }
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

recurringScheduleSchema.index({ userId: 1, status: 1 });
recurringScheduleSchema.index({ userId: 1, 'schedule.nextScheduledDate': 1 });
recurringScheduleSchema.index({ status: 1, 'schedule.nextScheduledDate': 1 });

recurringScheduleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('RecurringSchedule', recurringScheduleSchema);



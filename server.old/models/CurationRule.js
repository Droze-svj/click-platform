// Curation Rule Model
// Defines automated curation rules

const mongoose = require('mongoose');

const curationRuleSchema = new mongoose.Schema({
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
  isActive: {
    type: Boolean,
    default: true
  },
  criteria: {
    minScore: {
      type: Number,
      default: 70,
      min: 0,
      max: 100
    },
    platforms: [{
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
    }],
    contentTypes: [{
      type: String,
      enum: ['video', 'article', 'podcast', 'script', 'quote', 'image']
    }],
    tags: [String],
    excludeTags: [String],
    dateRange: {
      start: Date,
      end: Date
    }
  },
  actions: {
    autoSchedule: {
      type: Boolean,
      default: false
    },
    scheduleDate: Date,
    scheduleInterval: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: null
    },
    maxItems: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    platforms: [{
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
    }]
  },
  lastRun: {
    type: Date,
    default: null
  },
  runCount: {
    type: Number,
    default: 0
  },
  itemsCurated: {
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

curationRuleSchema.index({ userId: 1, isActive: 1 });
curationRuleSchema.index({ lastRun: 1 });

curationRuleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CurationRule', curationRuleSchema);



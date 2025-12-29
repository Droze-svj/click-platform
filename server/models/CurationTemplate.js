// Curation Template Model
// Save and reuse curation configurations

const mongoose = require('mongoose');

const curationTemplateSchema = new mongoose.Schema({
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
  description: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: false
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
  useCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: null
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

curationTemplateSchema.index({ userId: 1 });
curationTemplateSchema.index({ isPublic: 1 });
curationTemplateSchema.index({ useCount: -1 });

curationTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CurationTemplate', curationTemplateSchema);



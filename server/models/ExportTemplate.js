// Export Template Model
// Reusable export configurations

const mongoose = require('mongoose');

const exportTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  // Template configuration
  template: {
    type: {
      type: String,
      enum: ['content', 'analytics', 'reports', 'assets', 'bulk'],
      required: true
    },
    format: {
      type: String,
      enum: ['csv', 'excel', 'pdf', 'json', 'xml', 'zip'],
      required: true
    },
    filters: mongoose.Schema.Types.Mixed,
    options: mongoose.Schema.Types.Mixed,
    columns: [String], // For CSV/Excel - which columns to include
    sorting: {
      field: String,
      order: { type: String, enum: ['asc', 'desc'], default: 'asc' }
    }
  },
  // Scheduling
  schedule: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom']
    },
    dayOfWeek: Number, // 0-6 for weekly
    dayOfMonth: Number, // 1-31 for monthly
    time: String, // HH:mm format
    timezone: String,
    nextRun: Date
  },
  // Sharing
  sharing: {
    isPublic: { type: Boolean, default: false },
    sharedWith: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      permission: {
        type: String,
        enum: ['view', 'use', 'edit'],
        default: 'use'
      }
    }]
  },
  // Usage stats
  stats: {
    timesUsed: { type: Number, default: 0 },
    lastUsed: Date,
    successRate: { type: Number, default: 100 } // percentage
  },
  isActive: {
    type: Boolean,
    default: true
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

exportTemplateSchema.index({ userId: 1, isActive: 1 });
exportTemplateSchema.index({ 'sharing.isPublic': 1, isActive: 1 });

exportTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ExportTemplate', exportTemplateSchema);



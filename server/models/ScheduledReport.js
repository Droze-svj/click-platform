// Scheduled Report Model
// Automated report generation and delivery

const mongoose = require('mongoose');

const scheduledReportSchema = new mongoose.Schema({
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReportTemplate',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Schedule configuration
  schedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true
    },
    dayOfWeek: {
      type: Number, // 0-6 (Sunday-Saturday) for weekly
      default: null
    },
    dayOfMonth: {
      type: Number, // 1-31 for monthly
      default: null
    },
    time: {
      type: String, // HH:MM format
      default: '09:00'
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  // Delivery configuration
  delivery: {
    email: {
      enabled: { type: Boolean, default: true },
      recipients: [String] // Email addresses
    },
    portal: {
      enabled: { type: Boolean, default: true },
      notify: { type: Boolean, default: true }
    },
    webhook: {
      enabled: { type: Boolean, default: false },
      url: String,
      secret: String
    }
  },
  // Report period configuration
  periodConfig: {
    type: {
      type: String,
      enum: ['last_period', 'rolling', 'custom'],
      default: 'last_period'
    },
    days: Number, // For rolling periods
    customStart: Date,
    customEnd: Date
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  lastGenerated: Date,
  nextGeneration: Date,
  generationCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

scheduledReportSchema.index({ agencyWorkspaceId: 1, isActive: 1, nextGeneration: 1 });
scheduledReportSchema.index({ clientWorkspaceId: 1, isActive: 1 });

scheduledReportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate next generation time
  if (this.isActive && !this.nextGeneration) {
    this.nextGeneration = calculateNextGeneration(this.schedule);
  }
  
  next();
});

function calculateNextGeneration(schedule) {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);
  
  let next = new Date();
  next.setHours(hours, minutes, 0, 0);
  
  switch (schedule.frequency) {
    case 'daily':
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'weekly':
      const dayDiff = schedule.dayOfWeek - next.getDay();
      if (dayDiff < 0 || (dayDiff === 0 && next <= now)) {
        next.setDate(next.getDate() + (7 + dayDiff));
      } else {
        next.setDate(next.getDate() + dayDiff);
      }
      break;
    case 'monthly':
      next.setDate(schedule.dayOfMonth || 1);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }
  
  return next;
}

module.exports = mongoose.model('ScheduledReport', scheduledReportSchema);



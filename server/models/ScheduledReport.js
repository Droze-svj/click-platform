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
    required: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
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

// NOTE: kept in sync with services/scheduledReportService.calculateNextGeneration.
// Must handle EVERY frequency enum value (incl. quarterly/yearly) and never
// return a past time — a past nextGeneration makes the cron re-fire every tick.
function calculateNextGeneration(schedule = {}) {
  const now = new Date();
  const [hRaw, mRaw] = String((schedule && schedule.time) || '09:00').split(':').map(Number);
  const hours = Number.isFinite(hRaw) ? hRaw : 9;
  const minutes = Number.isFinite(mRaw) ? mRaw : 0;

  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
  case 'daily':
    if (next <= now) next.setDate(next.getDate() + 1);
    break;
  case 'weekly': {
    const target = Number.isFinite(schedule.dayOfWeek) ? schedule.dayOfWeek : next.getDay();
    let dayDiff = target - next.getDay();
    if (dayDiff < 0 || (dayDiff === 0 && next <= now)) dayDiff += 7;
    next.setDate(next.getDate() + dayDiff);
    break;
  }
  case 'monthly':
    next.setDate(schedule.dayOfMonth || 1);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    break;
  case 'quarterly':
    next.setDate(schedule.dayOfMonth || 1);
    while (next <= now) next.setMonth(next.getMonth() + 3);
    break;
  case 'yearly':
    next.setDate(schedule.dayOfMonth || 1);
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
    break;
  default:
    if (next <= now) next.setDate(next.getDate() + 1);
  }

  return next;
}

module.exports = mongoose.model('ScheduledReport', scheduledReportSchema);



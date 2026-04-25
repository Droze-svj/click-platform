// Calendar View Model
// Saved calendar views and templates

const mongoose = require('mongoose');

const calendarViewSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  viewType: {
    type: String,
    enum: ['day', 'week', 'month', 'custom'],
    default: 'month'
  },
  filters: {
    clientWorkspaceIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace'
    }],
    platforms: [String],
    teamMemberIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    status: [String],
    dateRange: {
      startDate: Date,
      endDate: Date
    },
    search: String
  },
  grouping: {
    type: String,
    enum: ['date', 'client', 'platform', 'team', 'none'],
    default: 'date'
  },
  displayOptions: {
    showConflicts: { type: Boolean, default: true },
    showPerformance: { type: Boolean, default: false },
    showApprovalStatus: { type: Boolean, default: true },
    showTeamMembers: { type: Boolean, default: true },
    colorBy: {
      type: String,
      enum: ['client', 'platform', 'status', 'team', 'performance'],
      default: 'platform'
    },
    compactMode: { type: Boolean, default: false }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isShared: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['viewer', 'editor']
    }
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

calendarViewSchema.index({ agencyWorkspaceId: 1, createdBy: 1 });
calendarViewSchema.index({ agencyWorkspaceId: 1, isDefault: 1 });

calendarViewSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CalendarView', calendarViewSchema);



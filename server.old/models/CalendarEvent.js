// Calendar Event Model
// Extended event data for calendar items (comments, notes, performance preview)

const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  scheduledPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true,
    unique: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    editedAt: Date,
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  notes: {
    type: String,
    default: ''
  },
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  performancePreview: {
    predictedEngagement: Number,
    predictedReach: Number,
    predictedClicks: Number,
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    factors: [String], // Reasons for prediction
    lastCalculated: Date
  },
  approvalStatus: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested', 'not_required'],
      default: 'not_required'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String,
    requestedChanges: String
  },
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

calendarEventSchema.index({ agencyWorkspaceId: 1, createdAt: -1 });
calendarEventSchema.index({ 'comments.userId': 1 });
// scheduledPostId already has unique: true which creates an index

calendarEventSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);



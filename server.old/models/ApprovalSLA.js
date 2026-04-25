// Approval SLA Model
// Track SLA compliance and escalation

const mongoose = require('mongoose');

const approvalSLASchema = new mongoose.Schema({
  approvalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContentApproval',
    required: true,
    index: true
  },
  stageOrder: {
    type: Number,
    required: true
  },
  stageName: {
    type: String,
    required: true
  },
  targetHours: {
    type: Number,
    required: true
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  targetCompletionAt: {
    type: Date,
    required: true
  },
  completedAt: Date,
  status: {
    type: String,
    enum: ['on_time', 'at_risk', 'overdue', 'completed'],
    default: 'on_time'
  },
  escalated: {
    type: Boolean,
    default: false
  },
  escalatedAt: Date,
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reminders: [{
    sentAt: Date,
    type: {
      type: String,
      enum: ['warning', 'at_risk', 'overdue']
    }
  }],
  metadata: {
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

approvalSLASchema.index({ approvalId: 1, stageOrder: 1 });
approvalSLASchema.index({ status: 1, targetCompletionAt: 1 });
approvalSLASchema.index({ escalated: 1, escalatedAt: 1 });

approvalSLASchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update status based on time
  if (!this.completedAt) {
    const now = new Date();
    const hoursRemaining = (this.targetCompletionAt - now) / (1000 * 60 * 60);
    
    if (hoursRemaining < 0) {
      this.status = 'overdue';
    } else if (hoursRemaining < (this.targetHours * 0.2)) {
      this.status = 'at_risk';
    } else {
      this.status = 'on_time';
    }
  } else {
    this.status = 'completed';
  }
  
  next();
});

module.exports = mongoose.model('ApprovalSLA', approvalSLASchema);


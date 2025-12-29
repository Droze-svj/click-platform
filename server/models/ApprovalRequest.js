// Approval request model

const mongoose = require('mongoose');

const approvalRequestSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: ['content', 'script', 'post'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  requestedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  message: {
    type: String,
    default: ''
  },
  response: {
    type: String,
    default: ''
  },
  respondedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
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

approvalRequestSchema.index({ requestedBy: 1, status: 1 });
approvalRequestSchema.index({ requestedFrom: 1, status: 1 });
approvalRequestSchema.index({ teamId: 1, status: 1 });
approvalRequestSchema.index({ entityType: 1, entityId: 1 });

approvalRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ApprovalRequest', approvalRequestSchema);








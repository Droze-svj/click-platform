// Approval Delegation Model
// Delegate approvals to other users

const mongoose = require('mongoose');

const approvalDelegationSchema = new mongoose.Schema({
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
  delegatedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  delegatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reason: {
    type: String,
    default: ''
  },
  expiresAt: Date,
  status: {
    type: String,
    enum: ['active', 'completed', 'revoked', 'expired'],
    default: 'active'
  },
  revokedAt: Date,
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

approvalDelegationSchema.index({ approvalId: 1, stageOrder: 1 });
approvalDelegationSchema.index({ delegatedTo: 1, status: 1 });
approvalDelegationSchema.index({ expiresAt: 1, status: 1 });

approvalDelegationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Check expiration
  if (this.expiresAt && new Date() > this.expiresAt && this.status === 'active') {
    this.status = 'expired';
  }
  
  next();
});

module.exports = mongoose.model('ApprovalDelegation', approvalDelegationSchema);



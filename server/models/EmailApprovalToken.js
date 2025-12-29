// Email Approval Token Model
// Secure tokens for email-based approvals

const mongoose = require('mongoose');
const crypto = require('crypto');

const emailApprovalTokenSchema = new mongoose.Schema({
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
  approverEmail: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  approverName: String,
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  action: {
    type: String,
    enum: ['approve', 'reject', 'request_changes'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  usedAt: Date,
  used: {
    type: Boolean,
    default: false,
    index: true
  },
  ipAddress: String,
  userAgent: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

emailApprovalTokenSchema.index({ token: 1, used: 1 });
emailApprovalTokenSchema.index({ approvalId: 1, stageOrder: 1 });

emailApprovalTokenSchema.pre('save', function(next) {
  if (this.isNew && !this.token) {
    // Generate secure token
    this.token = crypto.randomBytes(32).toString('hex');
  }
  next();
});

module.exports = mongoose.model('EmailApprovalToken', emailApprovalTokenSchema);



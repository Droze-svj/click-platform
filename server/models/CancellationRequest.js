// Cancellation Request Model
// Track cancellations and refunds

const mongoose = require('mongoose');

const cancellationRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subscriptionId: {
    type: String,
    index: true
  },
  // Cancellation details
  cancellation: {
    requestedAt: {
      type: Date,
      default: Date.now
    },
    effectiveDate: Date, // When cancellation takes effect
    reason: {
      type: String,
      enum: [
        'too_expensive',
        'not_using',
        'missing_features',
        'found_alternative',
        'technical_issues',
        'billing_issues',
        'other'
      ]
    },
    reasonDetails: String,
    method: {
      type: String,
      enum: ['self_serve', 'support'],
      default: 'self_serve'
    }
  },
  // Refund details
  refund: {
    requested: { type: Boolean, default: false },
    amount: Number,
    currency: { type: String, default: 'USD' },
    calculation: {
      originalAmount: Number,
      daysUsed: Number,
      daysRemaining: Number,
      proRatedAmount: Number,
      processingFee: Number,
      finalAmount: Number
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processed', 'rejected', 'cancelled'],
      default: 'pending'
    },
    processedAt: Date,
    refundMethod: {
      type: String,
      enum: ['original_payment', 'store_credit', 'bank_transfer']
    },
    transactionId: String
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled'],
    default: 'pending'
  },
  // Support interaction
  supportTicketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

cancellationRequestSchema.index({ userId: 1, status: 1 });
cancellationRequestSchema.index({ 'refund.status': 1 });

cancellationRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CancellationRequest', cancellationRequestSchema);



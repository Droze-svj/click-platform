// Cancellation Request Model
// Track cancellations and refunds

const mongoose = require('mongoose');

const cancellationRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
      // 'processing' — a refund attempt is in flight with the payment provider.
      // 'failed'     — the provider rejected it or is unreachable; needs a retry
      //                or an operator. Distinct from 'rejected', which means a
      //                human decided not to refund.
      // Both were missing while processRefund() assigned 'processing', so every
      // refund attempt threw a ValidationError on save.
      enum: ['pending', 'approved', 'processing', 'processed', 'failed', 'rejected', 'cancelled'],
      default: 'pending'
    },
    processedAt: Date,
    refundMethod: {
      type: String,
      enum: ['original_payment', 'store_credit', 'bank_transfer']
    },
    // The payment provider's own refund id. Only ever set from a real provider
    // response — never synthesized.
    transactionId: String,
    // Why a refund is sitting in 'failed'/'pending', for the operator queue.
    failureReason: String
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



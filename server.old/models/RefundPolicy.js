// Refund Policy Model
// Clear refund rules and policies

const mongoose = require('mongoose');

const refundPolicySchema = new mongoose.Schema({
  policyType: {
    type: String,
    enum: ['pro_rated', 'full_refund', 'no_refund', 'partial_refund'],
    required: true
  },
  // Applies to
  appliesTo: {
    tiers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UsageBasedTier'
    }],
    plans: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgencyScalePlan'
    }],
    all: { type: Boolean, default: false }
  },
  // Refund rules
  rules: {
    // Pro-rated refund
    proRated: {
      enabled: { type: Boolean, default: true },
      calculationMethod: {
        type: String,
        enum: ['daily', 'hourly'],
        default: 'daily'
      },
      minimumDays: { type: Number, default: 0 }, // Minimum days for pro-rated refund
      processingFee: { type: Number, default: 0 } // Processing fee percentage
    },
    // Full refund
    fullRefund: {
      enabled: { type: Boolean, default: false },
      timeLimit: { type: Number, default: 14 }, // Days from purchase
      conditions: [String] // Conditions for full refund
    },
    // Partial refund
    partialRefund: {
      enabled: { type: Boolean, default: false },
      percentage: { type: Number, default: 0 }, // Percentage to refund
      conditions: [String]
    },
    // No refund
    noRefund: {
      enabled: { type: Boolean, default: false },
      exceptions: [String] // Exceptions where refund is allowed
    }
  },
  // Cancellation policy
  cancellation: {
    selfServe: { type: Boolean, default: true }, // Allow self-serve cancellation
    immediate: { type: Boolean, default: true }, // Immediate cancellation vs end of period
    noticePeriod: { type: Number, default: 0 } // Days notice required
  },
  // Display
  displayText: String, // Human-readable policy text
  termsUrl: String, // Link to full terms
  isActive: {
    type: Boolean,
    default: true
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

refundPolicySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('RefundPolicy', refundPolicySchema);



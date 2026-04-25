const mongoose = require('mongoose');

const monetizationTriggerSchema = new mongoose.Schema({
  startTime: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    default: 10
  },
  intentScore: Number,
  reason: String,
  productId: String,
  productName: String,
  productPrice: Number,
  productCurrency: {
    type: String,
    default: 'USD'
  },
  overlayConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      type: 'checkout-qr',
      position: { x: 50, y: 70 },
      style: 'neural-glass'
    }
  },
  checkoutUrl: String,
  isCustom: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const monetizationPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true
  },
  provider: {
    type: String,
    enum: ['whop', 'shopify', 'custom'],
    default: 'whop'
  },
  triggers: [monetizationTriggerSchema],
  status: {
    type: String,
    enum: ['draft', 'finalized', 'archived'],
    default: 'draft'
  },
  metadata: {
    transcriptUsed: String,
    detectedAt: {
      type: Date,
      default: Date.now
    }
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

monetizationPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MonetizationPlan', monetizationPlanSchema);

// Subscription Change Model
// Track subscription upgrades, downgrades, and changes

const mongoose = require('mongoose');

const subscriptionChangeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  changeType: {
    type: String,
    enum: ['upgrade', 'downgrade', 'renewal', 'cancellation', 'reactivation', 'addon_purchase', 'addon_removal'],
    required: true
  },
  fromPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPackage'
  },
  toPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPackage'
  },
  fromBillingCycle: {
    type: String,
    enum: ['monthly', 'yearly']
  },
  toBillingCycle: {
    type: String,
    enum: ['monthly', 'yearly']
  },
  proratedAmount: {
    type: Number,
    default: 0
  },
  proratedCredit: {
    type: Number,
    default: 0
  },
  effectiveDate: {
    type: Date,
    required: true
  },
  billingDate: {
    type: Date
  },
  addOns: [{
    addOnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AddOn'
    },
    action: {
      type: String,
      enum: ['added', 'removed']
    }
  }],
  promoCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCode'
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  paymentIntentId: String, // Stripe payment intent ID
  invoiceId: String,
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

subscriptionChangeSchema.index({ userId: 1, createdAt: -1 });
subscriptionChangeSchema.index({ status: 1, createdAt: -1 });

subscriptionChangeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('SubscriptionChange', subscriptionChangeSchema);



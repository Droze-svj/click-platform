// Promo Code Model
// Discount codes and promotional offers

const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  description: String,
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'free_months'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  applicablePackages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPackage'
  }], // Empty = all packages
  applicableAddOns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AddOn'
  }],
  minPurchaseAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: Number, // For percentage discounts
  maxUses: {
    type: Number,
    default: -1 // -1 = unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  maxUsesPerUser: {
    type: Number,
    default: 1
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: Date,
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

promoCodeSchema.index({ code: 1, isActive: 1 });
promoCodeSchema.index({ validFrom: 1, validUntil: 1 });

promoCodeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PromoCode', promoCodeSchema);



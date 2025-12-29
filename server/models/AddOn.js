// Add-On Model
// Purchasable add-ons for subscription packages

const mongoose = require('mongoose');

const addOnSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  category: {
    type: String,
    enum: ['usage', 'feature', 'support', 'storage', 'team'],
    required: true
  },
  price: {
    monthly: Number,
    yearly: Number,
    oneTime: Number // For one-time purchases
  },
  features: {
    additionalVideos: { type: Number, default: 0 },
    additionalContentGenerations: { type: Number, default: 0 },
    additionalStorage: { type: Number, default: 0 }, // in bytes
    additionalBrands: { type: Number, default: 0 },
    additionalClientWorkspaces: { type: Number, default: 0 },
    additionalTeamMembers: { type: Number, default: 0 },
    enableFeature: String, // Feature name to enable
    prioritySupport: { type: Boolean, default: false }
  },
  compatiblePackages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPackage'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
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

addOnSchema.index({ slug: 1 });
addOnSchema.index({ category: 1, isActive: 1 });

addOnSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AddOn', addOnSchema);



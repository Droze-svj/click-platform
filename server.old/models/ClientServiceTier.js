// Client Service Tier Assignment Model
// Track which tier each client is on

const mongoose = require('mongoose');

const clientServiceTierSchema = new mongoose.Schema({
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  serviceTierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceTier',
    required: true,
    index: true
  },
  tierName: {
    type: String,
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date,
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'upgraded', 'downgraded'],
    default: 'active',
    index: true
  },
  usage: {
    postsThisWeek: { type: Number, default: 0 },
    postsThisMonth: { type: Number, default: 0 },
    platformsUsed: [String],
    reportsGenerated: { type: Number, default: 0 },
    lastReset: Date
  },
  billing: {
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    amount: Number,
    currency: { type: String, default: 'USD' }
  },
  metadata: {
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
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

clientServiceTierSchema.index({ agencyWorkspaceId: 1, status: 1 });
clientServiceTierSchema.index({ 'billing.currentPeriodEnd': 1 });

clientServiceTierSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ClientServiceTier', clientServiceTierSchema);



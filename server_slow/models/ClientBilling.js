// Client Billing Model
// Per-client usage and billing tracking

const mongoose = require('mongoose');

const clientBillingSchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  billingPeriod: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    month: Number,
    year: Number
  },
  usage: {
    contentCreated: { type: Number, default: 0 },
    postsPublished: { type: Number, default: 0 },
    postsScheduled: { type: Number, default: 0 },
    workflowsExecuted: { type: Number, default: 0 },
    approvalsProcessed: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // in MB
    members: { type: Number, default: 0 }
  },
  limits: {
    contentCreated: { type: Number, default: null },
    postsPublished: { type: Number, default: null },
    postsScheduled: { type: Number, default: null },
    workflowsExecuted: { type: Number, default: null },
    apiCalls: { type: Number, default: null },
    storageUsed: { type: Number, default: null },
    members: { type: Number, default: null }
  },
  billing: {
    plan: {
      type: String,
      enum: ['starter', 'professional', 'enterprise', 'custom'],
      default: 'professional'
    },
    basePrice: { type: Number, default: 0 },
    usagePrice: { type: Number, default: 0 },
    overagePrice: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'overdue', 'cancelled'],
    default: 'active',
    index: true
  },
  invoiceId: String,
  invoiceUrl: String,
  paidAt: Date,
  dueDate: Date,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

clientBillingSchema.index({ agencyWorkspaceId: 1, clientWorkspaceId: 1, 'billingPeriod.month': 1, 'billingPeriod.year': 1 });
clientBillingSchema.index({ status: 1, dueDate: 1 });

clientBillingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ClientBilling', clientBillingSchema);


